import { attachObject, clearParentsJson, detachObject, getObjTreeMeta, TreeMeta } from './TreeMeta';
import { checkWeAreInAction, setData, toJSON } from './utils';
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
    if (field.hooks.set !== undefined) {
        value = field.hooks.set(value);
    }
    attachObject(arr, value);
    setData(value, value);
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

export class ArrayProxy<T = {}> implements This {
    _treeMeta = new TreeMeta<T[]>();
    _classMeta: ClassMeta = new ClassMeta();
    _version = new AtomValue(version);
    _values: T[] = [];

    get length() {
        return this._values.length;
    }

    constructor(public itemClassMeta: ClassMeta, values: T[] = []) {
        this._values = values;
        this._classMeta.fields = [createField('element')];
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
