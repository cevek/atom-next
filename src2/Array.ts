import { attach, clearParentsJson, detachObject, getObjTreeMeta, TreeMeta } from './TreeMeta';
import { factory, Reducer, setData, This, toJSON } from './utils';
import { AtomValue } from '../src/atom';
import { Field } from './Field';

let version = 0;
function mutate<Ret>(arr: ArrayProxy) {
    arr._version.set(version++);
    clearParentsJson(arr._treeMeta);
}

function attachJsonItem(arr: ArrayProxy, json: any, i: number) {
    const { elementFactory } = arr._fields[0];
    if (elementFactory === undefined) {
        return json;
    }
    const value = factory(elementFactory, undefined);
    const valueTreeMeta = getObjTreeMeta(value);
    if (valueTreeMeta !== undefined) {
        attach(arr._treeMeta, i, valueTreeMeta);
        setData(value, json);
        return value;
    } else {
        throw new Error('Never possible');
    }
}

function attachItems(arr: ArrayProxy, start: number, end: number) {
    for (let i = start; i < end; i++) {
        const value = arr._values[i];
        const valueTreeMeta = getObjTreeMeta(value);
        if (valueTreeMeta !== undefined) {
            attach(arr._treeMeta, i, valueTreeMeta);
        }
    }
}

function updateKeys(arr: ArrayProxy, start: number, end: number) {
    for (let i = start; i < end; i++) {
        const value = arr._values[i];
        const valueTreeMeta = getObjTreeMeta(value);
        if (valueTreeMeta !== undefined) {
            arr._treeMeta.key = i;
        }
    }
}

export function setArrayData(arr: ArrayProxy, json: any[]) {
    if (json instanceof Array) {
        const min = Math.min(arr._values.length, json.length);
        for (let i = 0; i < min; i++) {
            const childTreeMeta = getObjTreeMeta(arr._values[i]);
            if (childTreeMeta === undefined || childTreeMeta.json !== json[i]) {
                arr._values[i] = attachJsonItem(arr, json[i], i);
            }
        }
        for (let i = min; i < arr._values.length; i++) {
            detachObject(arr._values[i]);
        }
        for (let i = min; i < json.length; i++) {
            arr._values[i] = attachJsonItem(arr, json[i], i);
        }
        arr._values.length = json.length;
        arr._version.set(version++);
    }
}

export function toJSONArray(arr: ArrayProxy) {
    if (arr._treeMeta.json !== undefined) return arr._treeMeta.json;
    const newArr = Array(arr.length);
    for (let i = 0; i < arr._values.length; i++) {
        const item = arr._values[i];
        newArr[i] = toJSON(item);
    }
    arr._treeMeta.json = newArr;
    return newArr;
}

export class ArrayProxy<T = {}> implements This {
    _treeMeta = new TreeMeta<T[]>();
    _fields: Field[] = undefined!;
    _version = new AtomValue(version);
    _values: T[] = [];
    _reducers!: Reducer[];

    get length() {
        return this._values.length;
    }

    constructor(elementFactory?: new () => {}) {
        this._fields = [{ name: 'element', idx: -1, Class: elementFactory, elementFactory: undefined }];
    }

    push(...items: T[]) {
        const ret = this._values.push(...items);
        attachItems(this, this._values.length - items.length, this._values.length);
        mutate(this);
        return ret;
    }

    unshift(...items: T[]) {
        const ret = this._values.unshift(...items);
        attachItems(this, 0, items.length);
        mutate(this);
        return ret;
    }

    pop() {
        const ret = detachObject(this._values.pop());
        mutate(this);
        return ret;
    }

    shift() {
        const ret = detachObject(this._values.shift());
        mutate(this);
        return ret;
    }

    reverse() {
        this._values.reverse();
        mutate(this);
        updateKeys(this, 0, this._values.length);
        return this;
    }

    splice(start: number, deleteCount = 0, ...items: T[]) {
        for (let i = start; i < start + deleteCount; i++) {
            detachObject(this._values[i]);
        }
        const ret = this._values.splice(start, deleteCount, ...items);
        attachItems(this, start, start + items.length - deleteCount);
        updateKeys(this, start + items.length - deleteCount, items.length);
        mutate(this);
        return ret;
    }

    sort(compareFn?: (a: T | undefined, b: T | undefined) => number) {
        this._values.sort(compareFn);
        updateKeys(this, 0, this._values.length);
        mutate(this);
        return this;
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
