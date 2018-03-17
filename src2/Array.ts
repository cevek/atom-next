import { attachObject, clearParentsJson, detachObject, getObjTreeMeta, TreeMeta } from './TreeMeta';
import { checkWeAreInAction, neverPossible, toJSON } from './utils';
import { AtomValue } from './Atom';
import { ClassMeta } from './ClassMeta';
import { This } from './Entity';
import { createField, Field } from './Field';
import { glob } from './Glob';

let version = 0;
function mutate<Ret>(arr: ArrayProxy) {
    arr._version.set(++version);
    clearParentsJson(arr._treeMeta);
}

function attachJsonItem(arr: ArrayProxy, field: Field, value: any, i: number) {
    if (field.classMeta !== undefined) {
        value = field.classMeta.factory(value, arr._values[i]);
    }
    attachObject(arr, value);
    return value;
}

export function setArrayData(arr: ArrayProxy, json: any[]) {
    try {
        glob.inTransaction = true;
        const field = arr._classMeta.fields[0];
        if (json instanceof Array) {
            const min = Math.min(arr._values.length, json.length);
            for (let i = 0; i < min; i++) {
                const childTreeMeta = getObjTreeMeta(arr._values[i]);
                if (childTreeMeta === undefined || childTreeMeta.json !== json[i]) {
                    arr._values[i] = attachJsonItem(arr, field, json[i], i);
                }
            }
            for (let i = min; i < arr._values.length; i++) {
                detachObject(arr._values[i]);
            }
            for (let i = min; i < json.length; i++) {
                arr._values[i] = attachJsonItem(arr, field, json[i], i);
            }
            arr._values.length = json.length;
            arr._version.set(version++);
        }
    } finally {
        glob.inTransaction = false;
    }
}

export function toJSONArray(arr: ArrayProxy) {
    if (arr._treeMeta.json !== undefined) return arr._treeMeta.json;
    const newArr = Array(arr.length);
    for (let i = 0; i < arr._values.length; i++) {
        const item = arr._values[i];
        newArr[i] = toJSON(item as This);
    }
    arr._treeMeta.json = newArr;
    return newArr;
}

export function arrayFactory(elementClassMeta: ClassMeta, json: any, prevValue: any) {
    return new ArrayProxy(elementClassMeta, json);
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
        this._values = values;
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
        this._treeMeta.json = arr;
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
for (let i = 0; i < immutableMethods.length; i++) {
    const method = immutableMethods[i] as any;
    const fn = Array.prototype[method];
    (ArrayProxy.prototype as any)[method] = function(this: ArrayProxy) {
        this._version.get();
        return fn.apply(this._values, arguments);
    };
}
