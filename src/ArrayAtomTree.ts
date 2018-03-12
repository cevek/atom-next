import {
    ArrayTarget,
    AtomValue,
    buildAtomProxy,
    checkWeAreInTransaction,
    detach,
    Factory,
    getProxyOrRawValue,
    glob,
    Index,
    initValueIfNeeded,
    putProxyToUsing,
    rebuildTarget,
    Target,
} from './AtomTree';
import { AtomProxy } from './AtomProxy';

function _commit(proxy: ArrayProxy, start: number, end: number) {
    const newTarget = new Array(proxy._values.length) as ArrayTarget;
    for (let i = 0; i < proxy._values.length; i++) {
        newTarget[i] = proxy._values[i]!._target;
    }
    Object.freeze(newTarget);
    if (proxy._parent !== void 0) {
        rebuildTarget(proxy._parent, proxy._key, newTarget);
    }
    proxy._target = newTarget;
    if (proxy._rootStore !== void 0) {
        for (let i = start; i < end; i++) {
            proxy._rootStore._makePathAndAddToStorage(proxy._values[i], i);
        }
    }
    _updateVersion(proxy);
}

function _updateVersion(proxy: ArrayProxy) {
    detach(proxy._version);
    proxy._version = new AtomValue(glob.arrayVersion++);
    proxy.length = proxy._values.length;
}

function _makeArrayTargetsToProxy(proxy: ArrayProxy, arr: (Target | undefined)[], idxStart: number) {
    let newArr: (AtomProxy | AtomValue)[] = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
        newArr[i] = buildAtomProxy(proxy._rootStore, proxy, 0, idxStart + i, arr[i]!);
    }
    return newArr;
}

function _checkToExit(proxy: ArrayProxy) {
    checkWeAreInTransaction();
    return false; //inInitializing && initWithState;
}

export class ArrayProxy extends AtomProxy {
    _factoryClasses: (Factory | undefined)[] = [undefined];

    _target: ArrayTarget;
    _version: AtomValue = undefined!;
    // _values = [];

    length: number = 0;

    constructor() {
        super();
        if (glob.globFactory === undefined) {
            throw new Error('Factory is empty');
        }
        if (glob.globFactory.elementFactory === undefined) {
            throw new Error('Array element Factory is not specified');
        }
        this._factoryClasses[0] = glob.globFactory.elementFactory;
        this._target = [];
        _updateVersion(this);
    }

    _setTarget(target: ArrayTarget) {
        if (glob.inInitializing) {
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
                _updateVersion(this);
            }
        }
    }

    push(...items: Target[]) {
        if (_checkToExit(this)) return this._target.length;
        const ret = this._values.push(..._makeArrayTargetsToProxy(this, items, this._values.length));
        _commit(this, 0, 0);
        return ret;
    }

    unshift(...items: Target[]) {
        if (_checkToExit(this)) return this._target.length;
        const ret = this._values.unshift(..._makeArrayTargetsToProxy(this, items, 0));
        _commit(this, items.length, this._values.length);
        return ret;
    }

    pop(): Target | undefined {
        if (_checkToExit(this)) return void 0;
        const ret = this._values.pop();
        detach(ret);
        _commit(this, 0, 0);
        return getProxyOrRawValue(ret);
    }

    shift(): Target | undefined {
        if (_checkToExit(this)) return void 0;
        const ret = this._values.shift();
        detach(ret);
        _commit(this, 0, this._values.length);
        return getProxyOrRawValue(ret);
    }

    reverse() {
        if (_checkToExit(this)) return this;
        this._values.reverse();
        _commit(this, 0, this._values.length);
        return this;
    }

    splice(start: number, deleteCount = 0, ...items: Target[]) {
        if (_checkToExit(this)) return this;
        for (let i = start; i < start + deleteCount; i++) {
            detach(this._values[i]);
        }
        const ret = this._values.splice(start, deleteCount, ..._makeArrayTargetsToProxy(this, items, start));
        _commit(this, start, this._values.length);
        return ret;
    }

    sort(compareFn: (a: Target | undefined, b: Target | undefined) => number = () => 1) {
        if (_checkToExit(this)) return this;
        this._values.sort((a, b) => compareFn(getProxyOrRawValue(a), getProxyOrRawValue(b)));
        _commit(this, 0, this._values.length);
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
