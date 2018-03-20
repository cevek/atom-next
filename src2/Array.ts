import { attachObject, clearParentsJson, detachObject, getObjTreeMeta } from './TreeMeta';
import { checkWeAreInAction, toJSON } from './Utils';
import { ClassMeta, getClassMetaFromObj, getClassMetaOrThrow, getOrCreateClassMeta, transformValue } from './ClassMeta';
import { entity, skip } from './Decorators';
import { createField } from './Field';
import { EntityClass } from './Entity';

function mutate<Ret>(arr: ArrayProxy) {
    arr._version++;
    clearParentsJson(getObjTreeMeta(arr)!);
}

export function arrayFactory(
    elementClassMeta: ClassMeta | undefined,
    json: ArrayProxy | {}[],
    array: ArrayProxy | undefined
) {
    if (json instanceof ArrayProxy) return json;
    if (array === undefined) {
        array = new ArrayProxy();
        array._classMeta.fields = [createField('element', elementClassMeta)];
    }
    for (let i = array._values.length - 1; i >= json.length; i--) {
        array.pop();
    }
    for (let i = 0; i < json.length; i++) {
        array.set(i, json[i]);
    }
    return array;
}

function transformAndAttach(arr: ArrayProxy, items: {}[]) {
    for (let i = 0; i < items.length; i++) {
        const value = transformValue(arr._classMeta.fields[0], items[i], undefined);
        items[i] = value;
        attachObject(arr, value, undefined);
    }
}

@entity
export class ArrayProxy<T = {}> {
    _version = 0;
    _classMeta = new ClassMeta(undefined!);
    @skip _values: T[] = [];

    get length() {
        return this._values.length;
    }
    //
    // constructor(elementClassMeta: ClassMeta | undefined) {
    //     this._classMeta.fields.push(createField('element', elementClassMeta));
    // }

    @skip
    push(...items: T[]) {
        checkWeAreInAction();
        transformAndAttach(this, items);
        const ret = this._values.push(...items);
        mutate(this);
        return ret;
    }
    @skip
    unshift(...items: T[]) {
        checkWeAreInAction();
        transformAndAttach(this, items);
        const ret = this._values.unshift(...items);
        mutate(this);
        return ret;
    }
    @skip
    pop() {
        checkWeAreInAction();
        const ret = detachObject(this._values.pop());
        mutate(this);
        return ret;
    }
    @skip
    shift() {
        checkWeAreInAction();
        const ret = detachObject(this._values.shift());
        mutate(this);
        return ret;
    }
    @skip
    reverse() {
        checkWeAreInAction();
        this._values.reverse();
        mutate(this);
        return this;
    }
    @skip
    splice(start: number, deleteCount = 0, ...items: T[]) {
        checkWeAreInAction();
        // let shift = (start < 0 ? this._values.length + start : start) + Math.max(deleteCount, 0);
        const ret = this._values.splice(start, deleteCount, ...items);
        for (let i = 0; i < ret.length; i++) {
            detachObject(ret[i]);
        }
        transformAndAttach(this, items);
        mutate(this);
        return ret;
    }

    @skip
    sort(compareFn?: (a: T | undefined, b: T | undefined) => number) {
        checkWeAreInAction();
        this._values.sort(compareFn);
        mutate(this);
        return this;
    }

    @skip
    get(idx: number) {
        const version = this._version;
        return this._values[idx];
    }

    @skip
    set(idx: number, value: T) {
        const prevValue = idx < this._values.length ? this._values[idx] : undefined;
        const classMeta = getClassMetaFromObj(this)!;
        value = transformValue(classMeta.fields[0], value, prevValue);
        attachObject(this, value, prevValue);
        this._values[idx] = value;
        mutate(this);
    }

    @skip
    toJSON() {
        const arr = Array(this._values.length);
        for (let i = 0; i < this._values.length; i++) {
            arr[i] = toJSON(this._values[i]);
        }
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
    const method = immutableMethods[i];
    const fn = Array.prototype[method];
    ArrayProxy.prototype[method] = function(this: ArrayProxy) {
        const version = this._version;
        return fn.apply(this._values, arguments);
    };
}

export function array<T>(Cls: new () => T) {
    return function<Prop extends string, Trg extends Record<Prop, T[] | undefined>>(targetProto: Trg, prop: Prop) {
        const Class = (Cls as {}) as EntityClass;
        const Target = targetProto.constructor as EntityClass;
        const elementClassMeta = getClassMetaOrThrow(Class);
        const arrayClassMeta = new ClassMeta((json, prevValue) =>
            arrayFactory(elementClassMeta, json as {}[], prevValue as ArrayProxy)
        );
        const classMeta = getOrCreateClassMeta(Target, undefined!);
        const field = createField(prop, arrayClassMeta);
        classMeta.fields.push(field);
    };
}
