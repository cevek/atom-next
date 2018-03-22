import { attachObject, clearParentsJson, detachObject, getObjTreeMeta } from './TreeMeta';
import { AtomValue } from './Atom';
import { ClassMeta, getClassMetaFromObj, transformValue } from './ClassMeta';
import { checkWeAreInAction, toJSON } from './Utils';
import { addField, buildElementClassMeta, entity, skip } from './Decorators';
import { createField } from './Field';
import { EntityClass } from './Entity';

function mutate(map: HashMap) {
    clearParentsJson(getObjTreeMeta(map)!);
}

@entity
export class HashMap<T = {}> implements Map<string | number, T> {
    @skip _classMeta = new ClassMeta(undefined!);

    static factory<T>(
        elementClassMeta: ClassMeta | undefined,
        values: { [key: string]: T },
        map: HashMap<T> | undefined
    ) {
        if (values instanceof HashMap) return values;
        if (map !== undefined) {
            map.clear();
        } else {
            map = new HashMap<T>();
            map._classMeta.fields = [createField('element', elementClassMeta)];
        }
        const keys = Object.keys(values);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            map.set(key, values[key]);
        }
        return map;
    }

    private map: { [key: string]: AtomValue<T> } = {};

    get _keys() {
        const keys: string[] = [];
        const map = this.map;
        for (const key in map) {
            const value = map[key];
            if (value !== undefined) keys.push(key);
        }
        return keys;
    }

    get _values() {
        const keys = this._keys;
        const values = Array(keys.length);
        const map = this.map;
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            values[i] = map[key].get();
        }
        return values;
    }

    get _keyValues() {
        const keys = this.keys;
        const values = this.values;
        const keyValues = Array(keys.length);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = values[i];
            keyValues[i] = [key, value];
        }
        return keyValues;
    }

    get size() {
        return this.keys.length;
    }

    @skip
    keys() {
        return this._keys[Symbol.iterator]();
    }

    @skip
    values() {
        return this._values[Symbol.iterator]();
    }

    @skip
    get(key: string | number): T | undefined {
        const atom = this.map[key];
        if (atom !== undefined) {
            return atom.get();
        }
        return;
    }

    @skip
    has(key: string | number) {
        return this.map[key] !== undefined;
    }

    @skip
    set(key: string | number, value: T) {
        checkWeAreInAction();
        const classMeta = getClassMetaFromObj(this)!;
        let atom = this.map[key];
        const prevValue = atom === undefined ? undefined : (atom.value as T);
        value = transformValue(classMeta.fields[0], value, prevValue);
        if (atom == undefined) {
            this.map[key] = atom = new AtomValue(value, 'HashMap.map.' + key);
        } else {
            atom.set(value);
        }
        attachObject(this, value, prevValue);
        mutate(this);
        return this;
    }

    @skip
    delete(key: string | number) {
        checkWeAreInAction();
        const item = this.get(key);
        if (item !== undefined) {
            detachObject(item);
            this.map[key] = undefined!;
            mutate(this);
            return true;
        }
        return false;
    }

    @skip
    clear() {
        checkWeAreInAction();
        this.map = {};
        mutate(this);
    }

    @skip
    entries(): IterableIterator<[string | number, T]> {
        return this._keyValues[Symbol.iterator]();
    }

    @skip
    toJSON() {
        const json = {};
        const map = this.map;
        for (const key in map) {
            json[key] = toJSON(map[key]);
        }
        return json;
    }

    forEach(callbackfn: (value: T, key: string | number, map: Map<string | number, T>) => void, thisArg?: any) {
        const keyValues = this._keyValues;
        for (let i = 0; i < keyValues.length; i++) {
            const [key, value] = keyValues[i];
            callbackfn.call(thisArg, value, key, this);
        }
    }

    [Symbol.toStringTag]: 'Map' = 'Map';
    [Symbol.iterator]() {
        return this._keyValues[Symbol.iterator]();
    }
}

export function hash<T>(Cls: EntityClass<T> | ClassMeta | undefined) {
    return function<Prop extends string, Trg extends Record<Prop, Map<number | string, T> | undefined>>(
        targetProto: Trg,
        prop: Prop
    ) {
        addField(targetProto, prop, hashType(Cls));
    };
}

export function hashType<T>(Class?: EntityClass<T> | ClassMeta) {
    const elementClassMeta = buildElementClassMeta(Class);
    return new ClassMeta((json, prev) => HashMap.factory(elementClassMeta, json, prev as HashMap));
}
