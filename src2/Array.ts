import { attachObject, clearParentsJson, detachObject, getObjTreeMeta, getRootStore } from './TreeMeta';
import { checkWeAreInAction, toJSON } from './Utils';
import { ClassMeta, getClassMetaFromObj, getTransformValue, setTransformValue } from './ClassMeta';
import { createField } from './Field';
import { Base } from './Entity';
import { prop } from './Decorators';
import { DepsFix } from './DepsFix';

function mutate<Ret>(arr: ArrayProxy) {
    arr._version++;
    clearParentsJson(getObjTreeMeta(arr)!);
}

function transformAndAttach(arr: ArrayProxy, items: {}[]) {
    const rootStore = getRootStore(arr._treeMeta);
    for (let i = 0; i < items.length; i++) {
        const value = setTransformValue(rootStore, arr._classMeta.fields[0], items[i], undefined);
        items[i] = value;
        attachObject(arr, value, undefined);
    }
}

function checkVersion(arr: ArrayProxy) {
    // noinspection BadExpressionStatementJS
    arr._version;
}

export class ArrayProxy<T = {}> extends Base {
    /** @internal */ @prop _version = 0;
    /** @internal */
    protected validateClass() {}
    static factory(elementClassMeta: ClassMeta | undefined, json: ArrayProxy | {}[], array: ArrayProxy | undefined) {
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
    /** @internal */
    _classMeta = new ClassMeta({});

    /** @internal */
    _values: T[] = [];

    get length() {
        return this._values.length;
    }

    push(...items: T[]) {
        checkWeAreInAction();
        transformAndAttach(this, items);
        const ret = this._values.push(...items);
        mutate(this);
        return ret;
    }

    unshift(...items: T[]) {
        checkWeAreInAction();
        transformAndAttach(this, items);
        const ret = this._values.unshift(...items);
        mutate(this);
        return ret;
    }
    pop() {
        checkWeAreInAction();
        const ret = this._values.pop();
        detachObject(ret);
        mutate(this);
        return getTransformValue(getRootStore(this._treeMeta), this._classMeta.fields[0], ret);
    }
    shift() {
        checkWeAreInAction();
        const ret = this._values.shift();
        detachObject(ret);
        mutate(this);
        return getTransformValue(getRootStore(this._treeMeta), this._classMeta.fields[0], ret);
    }
    reverse() {
        checkWeAreInAction();
        this._values.reverse();
        mutate(this);
        return this;
    }
    splice(start: number, deleteCount = 0, ...items: T[]) {
        const field = this._classMeta.fields[0];
        checkWeAreInAction();
        const ret = this._values.splice(start, deleteCount, ...items);
        const rootStore = getRootStore(this._treeMeta);
        for (let i = 0; i < ret.length; i++) {
            const value = ret[i];
            detachObject(value);
            ret[i] = getTransformValue(rootStore, field, value);
        }
        transformAndAttach(this, items);
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
        checkVersion(this);
        return getTransformValue(getRootStore(this._treeMeta), this._classMeta.fields[0], this._values[idx]);
    }

    set(idx: number, value: T) {
        const prevValue = idx < this._values.length ? this._values[idx] : undefined;
        const classMeta = getClassMetaFromObj(this)!;
        value = setTransformValue(getRootStore(this._treeMeta), classMeta.fields[0], value, prevValue);
        attachObject(this, value, prevValue);
        this._values[idx] = value;
        mutate(this);
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
ArrayProxy.prototype._classMeta = new ClassMeta({});
DepsFix.ArrayProxy = ArrayProxy;

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
        checkVersion(this);
        const field = this._classMeta.fields[0];
        let values = this._values;
        const rootStore = getRootStore(this._treeMeta);
        if (field.classMeta !== undefined && field.classMeta.getTransformer !== undefined) {
            for (let j = 0; j < values.length; j++) {
                values[j] = getTransformValue(rootStore, field, values[j]);
            }
        }
        return fn.apply(values, arguments);
    };
}
