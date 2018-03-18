import { attachObject, clearParentsJson, detachObject, TreeMeta } from './TreeMeta';
import { checkWeAreInAction, Index, neverPossible, toJSON } from './Utils';
import { AtomValue } from './Atom';
import { ClassMeta } from './ClassMeta';
import { This } from './Entity';
import { createField } from './Field';

let version = 0;
function mutate<Ret>(arr: ArrayProxy) {
    arr._version.set(++version);
    clearParentsJson(arr._treeMeta);
}

export function arrayFactory(
    elementClassMeta: ClassMeta,
    json: ArrayProxy | {}[] | undefined,
    prevValue: ArrayProxy | undefined
) {
    if (json === undefined) return undefined;
    return new ArrayProxy(elementClassMeta, json instanceof ArrayProxy ? json._values : json);
}

export class ArrayProxy<T = {}> implements This {
    _treeMeta = new TreeMeta<T[]>();
    _classMeta = new ClassMeta(neverPossible);
    _version = new AtomValue(version);
    _values: T[] = [];

    get length() {
        return this._values.length;
    }

    constructor(public elementClassMeta: ClassMeta, values: T[] = []) {
        this._values = values.slice();
        this._classMeta.fields.push(createField('element', elementClassMeta));
    }

    push(...items: T[]) {
        checkWeAreInAction();
        const ret = this._values.push(...items);
        for (let i = 0; i < items.length; i++) {
            attachObject(this, items[i]);
        }
        mutate(this);
        return ret;
    }

    unshift(...items: T[]) {
        checkWeAreInAction();
        const ret = this._values.unshift(...items);
        for (let i = 0; i < items.length; i++) {
            attachObject(this, items[i]);
        }
        mutate(this);
        return ret;
    }

    pop() {
        checkWeAreInAction();
        const ret = detachObject(this._values.pop());
        mutate(this);
        return ret;
    }

    shift() {
        checkWeAreInAction();
        const ret = detachObject(this._values.shift());
        mutate(this);
        return ret;
    }

    reverse() {
        checkWeAreInAction();
        this._values.reverse();
        mutate(this);
        return this;
    }

    splice(start: number, deleteCount = 0, ...items: T[]) {
        checkWeAreInAction();
        const ret = this._values.splice(start, deleteCount, ...items);
        for (let i = 0; i < ret.length; i++) {
            detachObject(ret[i]);
        }
        for (let i = 0; i < items.length; i++) {
            attachObject(this, items[i]);
        }
        mutate(this);
        return ret;
    }

    sort(compareFn?: (a: T | undefined, b: T | undefined) => number) {
        checkWeAreInAction();
        this._values.sort(compareFn);
        mutate(this);
        return this;
    }

    get(idx: number) {
        this._version.get();
        return this._values[idx];
    }

    set(idx: number, value: T) {
        mutate(this);
        detachObject(this._values[idx]);
        attachObject(this, value);
        this._values[idx] = value;
    }

    toJSON() {
        if (this._treeMeta.json !== undefined) return this._treeMeta.json;
        const arr = Array(this._values.length);
        for (let i = 0; i < this._values.length; i++) {
            arr[i] = toJSON(this._values[i]);
        }
        this._treeMeta.json = arr as {};
        return arr;
    }

    [Symbol.iterator]() {
        return this._values[Symbol.iterator]();
    }
}

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
const arrayProto = (Array.prototype as {}) as Index<Function>;
const arrayProxyProto = (ArrayProxy.prototype as {}) as Index<Function>;
for (let i = 0; i < immutableMethods.length; i++) {
    const method = immutableMethods[i];
    const fn = arrayProto[method];
    arrayProxyProto[method] = function(this: ArrayProxy) {
        this._version.get();
        return fn.apply(this._values, arguments);
    };
}
