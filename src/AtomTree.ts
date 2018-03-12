export type Store<T> = {
    getState(): T;
    subscribe(callback: () => void): () => void;
    dispatch(action: Action): void;
};
export type Target = { [key: string]: Target; [key: number]: Target };
export type ArrayTarget = Target[] & { [key: string]: any };
export type Index = { [key: string]: any };

export class AtomValue {
    _attached = true;

    constructor(public _target: {}) {}

    _setTarget(target: Target) {
        this._target = target;
    }
}

let id = 1;
let arrayVersion = 0;
let inTransaction = false;
let inInitializing = false;

export const glob: { usingProxies: (AtomProxy | AtomValue)[] | undefined } = {
    usingProxies: void 0,
};

let globRootStore: RootStore | undefined;
let globParent: AtomProxy | undefined;
let globKey: string | number | undefined;
let globFactory: Factory | undefined;

export interface Factory {
    Class: typeof AtomProxy;
    elementFactory: Factory | undefined;
}

export interface CustomStore extends Store<{}> {
    atomStore: RootStore;
}

export interface ActionCreator {
    (payload: {}): void;

    reducer: (payload: {}) => void;
}

function isArray<T, K>(arr: T[] | K): arr is T[] {
    return arr instanceof Array;
}

function createArray<T>(length: number) {
    return Array<T>(length);
}

export class AtomProxy {
    constructor() {
        this._rootStore = globRootStore;
        this._parent = globParent;
        this._target = {};
        this._values = Array(this._fields.length);
        if (globRootStore !== void 0) {
            globRootStore._makePathAndAddToStorage(this, globKey!);
        }
    }

    _id = id++;
    _path: string = '';
    _parent: AtomProxy | undefined = void 0;
    _target: Target = {};
    _rootStore: RootStore | undefined = void 0;
    //
    // _getRootStore() {
    //     let rootStore: RootStore | void 0 = this.__rootStore;
    //     if (rootStore === void 0) {
    //         let parent = this._parent;
    //         while (parent !== void 0 && rootStore === void 0) {
    //             rootStore = parent.__rootStore;
    //         }
    //         this.__rootStore = rootStore;
    //     }
    //     return rootStore;
    // }

    // _keyIdx: number;
    _key: string | number = '';
    _attached = true;
    _values: (AtomProxy | AtomValue | undefined)[];

    _setTarget(target: Target) {
        if (inInitializing) {
            if (typeof target === 'object' && target !== null && target.constructor === Object) {
                this._target = target;
                for (let i = 0; i < this._fields.length; i++) {
                    const field = this._fields[i];
                    const value = initValueIfNeeded(this, i);
                    value._setTarget(target[field]);
                }
            }
        } else {
            throw new Error('Cannot set target');
        }
    }

    _detachAll() {
        for (let i = 0; i < this._values.length; i++) {
            detach(this._values[i]);
            this._values[i] = void 0;
        }
    }

    _cloneTarget(): Target {
        return {};
    }

    /* prototype fields */
    _fields!: string[];
    _excludedMethods!: string[];
    _factoryClasses!: (Factory | undefined)[];
}

AtomProxy.prototype._fields = [];
AtomProxy.prototype._factoryClasses = [];
AtomProxy.prototype._excludedMethods = [];

function buildAtomProxy(
    rootStore: RootStore | undefined,
    parent: AtomProxy,
    keyIdx: number,
    key: string | number,
    target: Target
) {
    target = getRawValueIfExists(target);
    const factory = parent._factoryClasses[keyIdx];
    if (factory === void 0) {
        return new AtomValue(target);
    }
    const prevInInitializing = inInitializing;
    const prevInTransaction = inTransaction;
    inInitializing = true;
    inTransaction = true;
    globKey = key;
    globRootStore = rootStore;
    globFactory = factory;
    globParent = parent;
    try {
        const proxy = new factory.Class();
        proxy._setTarget(target);
        return proxy;
    } finally {
        inInitializing = prevInInitializing;
        inTransaction = prevInTransaction;
        globKey = undefined;
        globRootStore = undefined;
        globFactory = undefined;
        globParent = undefined;
    }
}

export interface Action {
    type: string;
    path?: string;
    payload?: {};
}

// todo: make it pure
function convertPayloadToPlainObject(payload: Index) {
    if (typeof payload === 'object' && payload !== null) {
        if (payload instanceof AtomProxy) {
            return { _path: payload._path };
        }
        const keys = Object.keys(payload);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const val = payload[key];
            const newVal = convertPayloadToPlainObject(val);
            if (val !== newVal) {
                payload[key] = newVal;
            }
        }
    }
    return payload;
}

// todo: make it pure
function convertPayloadPlainObjectToNormal(payload: Index | undefined, instanceMap: Map<string, AtomProxy>) {
    if (typeof payload === 'object' && payload !== null) {
        if (payload._path) {
            return instanceMap.get(payload._path);
        }
        const keys = Object.keys(payload);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const val = payload[key];
            const newVal = convertPayloadPlainObjectToNormal(val, instanceMap);
            if (val !== newVal) {
                payload[key] = newVal;
            }
        }
    }
    return payload;
}

export class RootStore extends AtomProxy {
    _reducers = new Map<string, (payload: {}) => void>();
    _reduxStore!: CustomStore;
    _instanceMap = new Map<string, AtomProxy>();
    _factoryClasses: (Factory | undefined)[] = [];
    _factoryMap = new Map<string, number>();
    _stores: typeof BaseStore[];
    _fields: string[] = [];
    _values: (AtomProxy | AtomValue | undefined)[] = [];
    _path = 'root';

    setReduxStore(store: Store<{}>) {
        this._reduxStore = store as CustomStore;
        this._reduxStore.atomStore = this;
        store.subscribe(() => {
            const state = store.getState();
            if (state !== this._target) {
                this._replaceState(state);
            }
        });
    }

    _initialize(root: AtomProxy) {
        for (let i = 0; i < root._values.length; i++) {
            const value = initValueIfNeeded(root, i);
            if (value instanceof AtomProxy) {
                this._initialize(root._values[i] as AtomProxy);
            }
        }
    }

    _replaceState(target: Target | undefined) {
        inInitializing = true;
        try {
            this._detachAll();
            this._initialize(this);
            if (target !== undefined) {
                this._setTarget(target);
            }
        } finally {
            inInitializing = false;
        }
    }

    _makePathAndAddToStorage(proxy: AtomProxy | AtomValue | undefined, key: string | number) {
        if (proxy instanceof AtomProxy && proxy._parent !== void 0) {
            proxy._key = key;
            proxy._path = proxy._parent._path + '.' + proxy._key;
            this._instanceMap.set(proxy._path, proxy);
            for (let i = 0; i < proxy._values.length; i++) {
                this._makePathAndAddToStorage(proxy._values[i], proxy._fields[i]);
            }
        }
    }

    mainReducer = (state: {}, action: Action): {} => {
        const reducer = this._reducers.get(action.type);
        if (reducer !== void 0) {
            const instance = this._instanceMap.get(action.path!);
            if (instance !== void 0) {
                const prevInTransaction = inTransaction;
                inTransaction = true;
                try {
                    reducer.call(instance, convertPayloadPlainObjectToNormal(action.payload, this._instanceMap));
                    return this._target;
                } finally {
                    inTransaction = prevInTransaction;
                }
            } else {
                throw new Error('You try to use a detached object from the state tree');
            }
        } else if (action.type === '@@INIT') {
            this._replaceState(state);
        }
        return this._target;
    };

    dispatch(type: string, thisArg: AtomProxy, payload: {}) {
        payload = convertPayloadToPlainObject(payload);
        const action: Action = { type: type, path: thisArg._path, payload };
        this._reduxStore.dispatch(action);
    }

    constructor(stores: typeof BaseStore[]) {
        super();
        this._stores = stores;
        this._rootStore = this;
        this._stores.forEach((Store, i) => {
            this._registerReducersFromClass(Store);
            this._factoryMap.set(Store.name, i);
            this._factoryClasses.push({ Class: Store, elementFactory: undefined });
            this._fields.push(Store.name);
            this._values.push(void 0);
        });
    }

    // getMiddleware(): Middleware {
    //     return api => {
    //         console.log('middleware', api);
    //         return next => {
    //             return action => {
    //                 return next(action);
    //             };
    //         };
    //     };
    // }

    _registerReducersFromClass(Ctor: typeof AtomProxy) {
        const proto: AtomProxy = Ctor.prototype;
        const methods = Object.getOwnPropertyNames(proto);
        for (let i = 0; i < methods.length; i++) {
            const method = methods[i];
            if (
                proto._excludedMethods.indexOf(method) === -1 &&
                method[0] !== '_' &&
                method !== 'constructor' &&
                method !== 'cloneTarget'
            ) {
                const descriptor = Object.getOwnPropertyDescriptor(proto, method)!;
                const reducer = descriptor.value;
                if (typeof reducer === 'function') {
                    const name = Ctor.name + '.' + method;
                    if (this._reducers.has(name)) {
                        throw new Error('Reducer name collision: ' + name);
                    }
                    this._reducers.set(Ctor.name + '.' + method, ((proto as Index)[method] as ActionCreator).reducer);
                }
            }
        }
        for (let i = 0; i < proto._factoryClasses.length; i++) {
            const factory = proto._factoryClasses[i];
            if (factory !== undefined) {
                this._registerReducersFromClass(factory.Class);
                if (factory.elementFactory !== undefined) {
                    // todo: need to rethink
                    this._registerReducersFromClass(factory.elementFactory.Class);
                }
            }
        }
    }
}

class ArrayProxy extends AtomProxy {
    _factoryClasses: (Factory | undefined)[] = [undefined];

    _target: ArrayTarget;
    _version: AtomValue = undefined!;
    // _values = [];

    length: number = 0;

    constructor() {
        super();
        if (globFactory === undefined) {
            throw new Error('Factory is empty');
        }
        if (globFactory.elementFactory === undefined) {
            throw new Error('Array element Factory is not specified');
        }
        this._factoryClasses[0] = globFactory.elementFactory;
        this._target = [];
        this._updateVersion();
    }

    _commit(start: number, end: number) {
        const newTarget = new Array(this._values.length) as ArrayTarget;
        for (let i = 0; i < this._values.length; i++) {
            newTarget[i] = this._values[i]!._target;
        }
        Object.freeze(newTarget);
        if (this._parent !== void 0) {
            rebuildTarget(this._parent, this._key, newTarget);
        }
        this._target = newTarget;
        if (this._rootStore !== void 0) {
            for (let i = start; i < end; i++) {
                this._rootStore._makePathAndAddToStorage(this._values[i], i);
            }
        }
        this._updateVersion();
    }

    _updateVersion() {
        detach(this._version);
        this._version = new AtomValue(arrayVersion++);
        this.length = this._values.length;
    }

    _makeArrayTargetsToProxy(arr: (Target | undefined)[], idxStart: number) {
        let newArr: (AtomProxy | AtomValue)[] = new Array(arr.length);
        for (let i = 0; i < arr.length; i++) {
            newArr[i] = buildAtomProxy(this._rootStore, this, 0, idxStart + i, arr[i]!);
        }
        return newArr;
    }

    _checkToExit() {
        checkWeAreInTransaction();
        return false; //inInitializing && initWithState;
    }

    _setTarget(target: ArrayTarget) {
        if (inInitializing) {
            if (target instanceof Array) {
                const min = Math.min(this._values.length, target.length);
                for (let i = 0; i < min; i++) {
                    const value = initValueIfNeeded(this, i);
                    if (value instanceof AtomProxy) {
                        value._setTarget(target[i]);
                    }
                }
                for (let i = min; i < this._values.length; i++) {
                    detach(this._values[i]);
                }
                for (let i = min; i < target.length; i++) {
                    this._values[i] = buildAtomProxy(this._rootStore, this, 0, i, target[i]);
                }
                this._values.length = target.length;
                this._updateVersion();
            }
        }
    }

    push(...items: Target[]) {
        if (this._checkToExit()) return this._target.length;
        const ret = this._values.push(...this._makeArrayTargetsToProxy(items, this._values.length));
        this._commit(0, 0);
        return ret;
    }

    unshift(...items: Target[]) {
        if (this._checkToExit()) return this._target.length;
        const ret = this._values.unshift(...this._makeArrayTargetsToProxy(items, 0));
        this._commit(items.length, this._values.length);
        return ret;
    }

    pop(): Target | undefined {
        if (this._checkToExit()) return void 0;
        const ret = this._values.pop();
        detach(ret);
        this._commit(0, 0);
        return getProxyOrRawValue(ret);
    }

    shift(): Target | undefined {
        if (this._checkToExit()) return void 0;
        const ret = this._values.shift();
        detach(ret);
        this._commit(0, this._values.length);
        return getProxyOrRawValue(ret);
    }

    reverse() {
        if (this._checkToExit()) return this;
        this._values.reverse();
        this._commit(0, this._values.length);
        return this;
    }

    splice(start: number, deleteCount = 0, ...items: Target[]) {
        if (this._checkToExit()) return this;
        for (let i = start; i < start + deleteCount; i++) {
            detach(this._values[i]);
        }
        const ret = this._values.splice(start, deleteCount, ...this._makeArrayTargetsToProxy(items, start));
        this._commit(start, this._values.length);
        return ret;
    }

    sort(compareFn: (a: Target | undefined, b: Target | undefined) => number = () => 1) {
        if (this._checkToExit()) return this;
        this._values.sort((a, b) => compareFn(getProxyOrRawValue(a), getProxyOrRawValue(b)));
        this._commit(0, this._values.length);
        return this;
    }

    _cloneTarget(): Target {
        return this._target.slice() as ArrayTarget;
    }
}

// ArrayProxy.prototype._excludedMethods = [];
// ArrayProxy.prototype._fields = [];

const immutableMethods = [
    'toString',
    'toLocaleString',
    'concat',
    'join',
    'slice',
    'indexOf',
    'lastIndexOf',
    'every',
    'some',
    'forEach',
    'map',
    'filter',
    'reduce',
    'reduceRight',
];
for (let i = 0; i < immutableMethods.length; i++) {
    const method = immutableMethods[i];
    const fn = (Array.prototype as Index)[method];
    (ArrayProxy.prototype as Index)[method] = function(this: ArrayProxy) {
        putProxyToUsing(this._version);
        const a = new Array(this._values.length);
        for (let i = 0; i < this._values.length; i++) {
            a[i] = getProxyOrRawValue(this._values[i]);
        }
        return fn.apply(a, arguments);
    };
}

export class BaseStore extends AtomProxy {}

function checkWeAreInTransaction() {
    if (!inTransaction) {
        throw new Error('You cannot update the state outside of a reducer method');
    }
}

function rebuildTarget(proxy: AtomProxy, key: string | number, value: Target) {
    value = getRawValueIfExists(value);

    let clone = proxy._cloneTarget();
    clone[key] = value;
    Object.freeze(clone);
    proxy._target = clone;
    if (proxy._parent !== void 0) {
        rebuildTarget(proxy._parent, proxy._key, clone);
    }
}

function detach(proxy: AtomProxy | AtomValue | undefined) {
    if (proxy instanceof AtomProxy) {
        proxy._attached = false;
        // if (proxy._parent !== void 0) {
        // proxy._parent._values[proxy._keyIdx] = undefined!;
        // }
        proxy._parent = void 0;
        if (proxy._rootStore !== void 0) {
            proxy._rootStore._instanceMap.delete(proxy._path);
        }
        proxy._rootStore = void 0;
        if (proxy._values !== void 0) {
            for (let i = 0; i < proxy._values.length; i++) {
                detach(proxy._values[i]);
                proxy._values[i] = undefined;
            }
        }
    } else if (proxy instanceof AtomValue) {
        proxy._attached = false;
    }
}

function putProxyToUsing(proxy: AtomValue | AtomValue) {
    if (glob.usingProxies !== void 0) {
        if (glob.usingProxies.indexOf(proxy) === -1) {
            glob.usingProxies.push(proxy);
        }
    }
}

function getValue(proxy: AtomProxy, keyIdx: number) {
    if (!proxy._attached) {
        //todo:
    }
    const childProxy = initValueIfNeeded(proxy, keyIdx);
    if (proxy._attached) {
        putProxyToUsing(childProxy);
    }
    return getProxyOrRawValue(childProxy);
}

export function initValueIfNeeded(proxy: AtomProxy, keyIdx: number) {
    let childProxy = proxy._values[keyIdx];
    if (childProxy === void 0) {
        const key = proxy._fields[keyIdx];
        childProxy = buildAtomProxy(proxy._rootStore, proxy, keyIdx, key, proxy._target[key]);
        proxy._values[keyIdx] = childProxy;
    }
    return childProxy;
}

function getProxyOrRawValue(proxy: AtomProxy | AtomValue | undefined) {
    if (proxy instanceof AtomValue) {
        return proxy._target;
    }
    return proxy;
}

function getRawValueIfExists(value: AtomProxy | AtomValue | Target): Target {
    if (value instanceof AtomProxy || value instanceof AtomValue) {
        return value._target;
    }
    return value;
}

function setValue(proxy: AtomProxy, keyIdx: number, key: string, value: Target) {
    checkWeAreInTransaction();
    // if (inInitializing && initWithState) {
    //     return;
    // }
    if (!proxy._attached) {
        //todo:
    }

    rebuildTarget(proxy, key, value);
    detach(proxy._values[keyIdx]);
    proxy._values[keyIdx] = buildAtomProxy(proxy._rootStore, proxy, keyIdx, key, value);
}

function actionCreatorFactory(type: string, reducer: () => void) {
    const actionCreator = function(this: AtomProxy, payload: {}) {
        if (inTransaction) {
            reducer.call(this, payload);
        } else {
            if (this._rootStore !== void 0) {
                this._rootStore.dispatch(type, this, payload);
            } else {
                throw new Error('This object is not in the store tree');
            }
        }
    } as ActionCreator;
    actionCreator.reducer = reducer;
    return actionCreator;
}

export function prepareEntity<T>(
    Ctor: typeof AtomProxy & { new (): T },
    fields: (keyof T)[],
    excludedMethods: (keyof T)[],
    factories: { [key: string]: typeof AtomProxy | typeof AtomProxy[] }
) {
    const methods = Object.getOwnPropertyNames(Ctor.prototype);
    for (let i = 0; i < methods.length; i++) {
        const methodName = methods[i];
        if ((excludedMethods as string[]).indexOf(methodName) === -1 && methodName !== 'constructor') {
            const descriptor = Object.getOwnPropertyDescriptor(Ctor.prototype, methodName)!;
            if (typeof descriptor.value === 'function') {
                (Ctor.prototype as Index)[methodName] = actionCreatorFactory(
                    Ctor.name + '.' + methodName,
                    descriptor.value
                );
            }
        }
    }
    const factoriesItems = new Array<Factory>(fields.length);
    for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        const factoryField = factories[field] as typeof AtomProxy | (typeof AtomProxy)[];
        if (factoryField) {
            factoriesItems[i] = isArray(factoryField)
                ? {
                      Class: ArrayProxy,
                      elementFactory: {
                          Class: factoryField[0],
                          elementFactory: undefined,
                      },
                  }
                : { Class: factoryField, elementFactory: undefined };
        }
        Object.defineProperty(Ctor.prototype, field, {
            get: function(this: AtomProxy) {
                return getValue(this, i);
            },
            set: function(this: AtomProxy, value: Target) {
                setValue(this, i, field, value);
            },
        });
    }
    Ctor.prototype._fields = fields;
    Ctor.prototype._excludedMethods = excludedMethods;
    Ctor.prototype._factoryClasses = factoriesItems;
    Ctor.prototype._cloneTarget = function(this: AtomProxy) {
        let copy: Target = {};
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            copy[field] = this._target[field];
        }
        return copy;
    };
}
