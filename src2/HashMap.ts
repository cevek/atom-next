import { clearParentsJson, TreeMeta } from './TreeMeta';
import { AtomCalc, AtomValue } from './Atom';
import { ClassMeta } from './ClassMeta';
import { This } from './Entity';
import { neverPossible, toJSON } from './utils';
import { createField } from './Field';

function mutate<Ret>(arr: HashMap) {
    clearParentsJson(arr._treeMeta);
}

export function factoryMap<T>(
    elementClassMeta: ClassMeta,
    values: { [key: string]: T } | Map<string | number, T>,
    map: HashMap<T> | undefined
) {
    if (map === undefined) {
        map = new HashMap<T>(elementClassMeta);
    } else {
        map.clear();
    }
    if (values instanceof Map) {
        for (let [key, value] of values) {
            map.set(key, value);
        }
    } else {
        const keys = Object.keys(values);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            map.set(key, values[key]);
        }
    }
}

export class HashMap<T = {}> implements This {
    _classMeta = new ClassMeta(neverPossible);
    _treeMeta = new TreeMeta<T>();
    constructor(elementClassMeta: ClassMeta) {
        this._classMeta.fields.push(createField('element', elementClassMeta));
    }

    _keys = new AtomCalc(this, this._keyCalc);
    _keyCalc() {
        const keys = [];
        for (const key in this._treeMeta.atoms) {
            const value = this._treeMeta.atoms[key];
            if (value !== undefined) keys.push(key);
        }
        return keys;
    }
    _size = new AtomCalc(this, this._sizeCalc);
    _sizeCalc() {
        return this._keys.get().length;
    }

    _values = new AtomCalc(this, this._valuesCalc);
    _valuesCalc() {
        const keys = this._keys.get();
        const values = Array(keys.length);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            values[i] = this._treeMeta.atoms[key].get();
        }
        return values;
    }

    _keyValues = new AtomCalc(this, this._keyValuesCalc);
    _keyValuesCalc() {
        const keys = this._keys.get();
        const values = this._values.get();
        const keyValues = Array(keys.length);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = values[i];
            keyValues[i] = [key, value];
        }
        return keyValues;
    }

    keys() {
        return this._keys.get();
    }

    values() {
        return this._values.get();
    }

    get size() {
        return this._size.get();
    }

    get(key: string | number): T | undefined {
        const treeMeta = this._treeMeta;
        const atom = treeMeta.atoms[key];
        if (atom === undefined) return undefined;
        return atom.get() as T;
    }

    has(key: string | number) {
        const treeMeta = this._treeMeta;
        return treeMeta.atoms[key] !== undefined;
    }

    set(key: string | number, value: T) {
        const treeMeta = this._treeMeta;
        const atom = treeMeta.atoms[key];
        const valueClassMeta = this._classMeta.fields[0].classMeta;
        if (valueClassMeta !== undefined) {
            const prevValue = atom === undefined ? undefined : atom.get();
            value = valueClassMeta.factory(value, prevValue);
        }
        if (atom === undefined) {
            treeMeta.atoms[key] = new AtomValue(value);
        } else {
            atom.set(value);
        }
        mutate(this);
    }

    delete(key: string | number) {
        const treeMeta = this._treeMeta;
        const atom = treeMeta.atoms[key];
        if (atom !== undefined) {
            treeMeta.atoms[key] = undefined!;
        }
        mutate(this);
    }

    clear() {
        this._treeMeta.atoms = {};
        this._keys.reset();
        mutate(this);
    }

    entries() {
        return this._keyValues.get()[Symbol.iterator];
    }

    toJSON() {
        if (this._treeMeta.json !== undefined) return this._treeMeta.json;
        const keysValues = this._keyValues.get();
        const json: any = {};
        for (let i = 0; i < keysValues.length; i++) {
            const [key, value] = keysValues[i];
            json[key] = toJSON(value);
        }
        this._treeMeta.json = json;
    }

    [Symbol.iterator]() {
        return this._keyValues.get()[Symbol.iterator]();
    }
}
