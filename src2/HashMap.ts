import { clearParentsJson, detachObject, getObjTreeMeta } from './TreeMeta';
import { AtomValue } from './Atom';
import { ClassMeta, getClassMetaFromObj, getClassMetaOrThrow, getOrCreateClassMeta, transformValue } from './ClassMeta';
import { checkWeAreInAction, toJSON } from './Utils';
import { entity, skip } from './Decorators';
import { EntityClass } from './Entity';
import { createField } from './Field';

function mutate<Ret>(arr: HashMap) {
    clearParentsJson(getObjTreeMeta(arr)!);
}

export function factoryMap<T>(
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

@entity
export class HashMap<T = {}> {
    _classMeta = new ClassMeta(undefined!);

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
        return this._keys;
    }

    @skip
    values() {
        return this._values;
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

    set(key: string | number, value: T) {
        checkWeAreInAction();
        let atom = this.map[key];
        if (atom == undefined) {
            atom = new AtomValue(value);
        }
        const prevValue = atom === undefined ? undefined : (atom.get() as T);
        const classMeta = getClassMetaFromObj(this)!;
        value = transformValue(classMeta.fields[0], value, prevValue);
        if (atom === undefined) {
            this.map[key] = atom = new AtomValue(value);
        } else {
            atom.set(value);
        }
        mutate(this);
    }

    delete(key: string | number) {
        checkWeAreInAction();
        const item = this.get(key);
        detachObject(item);
        this.map[key] = undefined!;
        mutate(this);
    }

    clear() {
        checkWeAreInAction();
        this.map = {};
        mutate(this);
    }

    @skip
    entries() {
        return this._keyValues[Symbol.iterator];
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

    [Symbol.iterator]() {
        return this._keyValues[Symbol.iterator]();
    }
}

export function hash<T>(Cls: new () => T) {
    return function<Prop extends string, Trg extends Record<Prop, Map<number | string, T> | undefined>>(
        targetProto: Trg,
        prop: Prop
    ) {
        const Class = (Cls as {}) as EntityClass;
        const Target = targetProto.constructor as EntityClass;

        const elementClassMeta = getClassMetaOrThrow(Class);
        const mapClassMeta = new ClassMeta((json, prev) => factoryMap(elementClassMeta, json, prev as HashMap));

        const classMeta = getOrCreateClassMeta(Target, undefined!);
        const field = createField(prop, mapClassMeta);
        classMeta.fields.push(field);
    };
}
