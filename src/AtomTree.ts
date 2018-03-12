import { ArrayProxy } from './ArrayAtomTree';
import { AtomProxy } from './AtomProxy';

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

export class Glob {
    usingProxies: (AtomProxy | AtomValue)[] | undefined = undefined;
    globRootStore: RootStore | undefined = undefined;
    globParent: AtomProxy | undefined = undefined;
    globKey: string | number | undefined = undefined;
    globFactory: Factory | undefined = undefined;

    id = 1;
    arrayVersion = 0;
    inTransaction = false;
    inInitializing = false;
}

export const glob = new Glob();

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

function _detachAll(proxy: AtomProxy) {
    for (let i = 0; i < proxy._values.length; i++) {
        detach(proxy._values[i]);
        proxy._values[i] = void 0;
    }
}

function _cloneTarget(proxy: AtomProxy): Target {
    return {};
}

export function buildAtomProxy(
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
    const prevInInitializing = glob.inInitializing;
    const prevInTransaction = glob.inTransaction;
    glob.inInitializing = true;
    glob.inTransaction = true;
    glob.globKey = key;
    glob.globRootStore = rootStore;
    glob.globFactory = factory;
    glob.globParent = parent;
    try {
        const proxy = new factory.Class();
        proxy._setTarget(target);
        return proxy;
    } finally {
        glob.inInitializing = prevInInitializing;
        glob.inTransaction = prevInTransaction;
        glob.globKey = undefined;
        glob.globRootStore = undefined;
        glob.globFactory = undefined;
        glob.globParent = undefined;
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
        glob.inInitializing = true;
        try {
            _detachAll(this);
            this._initialize(this);
            if (target !== undefined) {
                this._setTarget(target);
            }
        } finally {
            glob.inInitializing = false;
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
                const prevInTransaction = glob.inTransaction;
                glob.inTransaction = true;
                try {
                    reducer.call(instance, convertPayloadPlainObjectToNormal(action.payload, this._instanceMap));
                    return this._target;
                } finally {
                    glob.inTransaction = prevInTransaction;
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

export class BaseStore extends AtomProxy {}

export function checkWeAreInTransaction() {
    if (!glob.inTransaction) {
        throw new Error('You cannot update the state outside of a reducer method');
    }
}

export function rebuildTarget(proxy: AtomProxy, key: string | number, value: Target) {
    value = getRawValueIfExists(value);

    let clone = _cloneTarget(proxy);
    clone[key] = value;
    Object.freeze(clone);
    proxy._target = clone;
    if (proxy._parent !== void 0) {
        rebuildTarget(proxy._parent, proxy._key, clone);
    }
}

export function detach(proxy: AtomProxy | AtomValue | undefined) {
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

export function putProxyToUsing(proxy: AtomValue | AtomProxy) {
    if (glob.usingProxies !== void 0) {
        if (glob.usingProxies.indexOf(proxy) === -1) {
            glob.usingProxies.push(proxy);
        }
    }
}

export function getValue(proxy: AtomProxy, keyIdx: number) {
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

export function getProxyOrRawValue(proxy: AtomProxy | AtomValue | undefined) {
    if (proxy instanceof AtomValue) {
        return proxy._target;
    }
    return proxy;
}

export function getRawValueIfExists(value: AtomProxy | AtomValue | Target): Target {
    if (value instanceof AtomProxy || value instanceof AtomValue) {
        return value._target;
    }
    return value;
}

export function setValue(proxy: AtomProxy, keyIdx: number, key: string, value: Target) {
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

export function actionCreatorFactory(type: string, reducer: () => void) {
    const actionCreator = function(this: AtomProxy, payload: {}) {
        if (glob.inTransaction) {
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
