import { attachObject, clearParentsJson, detachObject, getObjTreeMeta } from './TreeMeta';
import { AtomValue } from './Atom';
import { ClassMeta, getClassMetaFromObj, getTransformValue, setTransformValue } from './ClassMeta';
import { checkWeAreInAction, toJSON } from './Utils';
import { addField, buildElementClassMeta, calc, prop } from './Decorators';
import { createField } from './Field';
import { Base } from './Entity';

function mutate(map: HashMap) {
    clearParentsJson(getObjTreeMeta(map)!);
}

export class HashMap<T = {}> extends Base implements Map<string | number, T> {
    _classMeta = new ClassMeta(undefined, undefined);

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

    @prop private map: { [key: string]: AtomValue<T> } = {};

    @calc
    private get _keys() {
        const keys: string[] = [];
        const map = this.map;
        for (const key in map) {
            const value = map[key];
            if (value !== undefined) keys.push(key);
        }
        return keys;
    }

    @calc
    private get _values() {
        const keys = this._keys;
        const field = this._classMeta.fields[0];
        const values = Array(keys.length);
        const map = this.map;
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            values[i] = getTransformValue(this, field, map[key].get());
        }
        return values;
    }

    @calc
    private get _keyValues() {
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

    keys() {
        return this._keys[Symbol.iterator]();
    }

    values() {
        return this._values[Symbol.iterator]();
    }

    get(key: string | number): T | undefined {
        const atom = this.map[key];
        if (atom !== undefined) {
            return atom.get();
        }
        return;
    }

    has(key: string | number) {
        return this.map[key] !== undefined;
    }

    set(key: string | number, value: T) {
        checkWeAreInAction();
        const classMeta = getClassMetaFromObj(this)!;
        let atom = this.map[key];
        const prevValue = atom === undefined ? undefined : (atom.value as T);
        value = setTransformValue(classMeta.fields[0], value, prevValue);
        if (atom == undefined) {
            atom = new AtomValue(value, 'HashMap.map.' + key);
            this.map[key] = atom;
        } else {
            atom.set(value);
        }
        attachObject(this, value, prevValue);
        mutate(this);
        return this;
    }

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

    clear() {
        checkWeAreInAction();
        this.map = {};
        mutate(this);
    }

    entries(): IterableIterator<[string | number, T]> {
        return this._keyValues[Symbol.iterator]();
    }

    toJSON() {
        if (this._treeMeta.json !== undefined) return this._treeMeta.json;
        const json = {};
        const map = this.map;
        for (const key in map) {
            json[key] = toJSON(map[key].value);
        }
        this._treeMeta.json = json;
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

export function hash<T>(Cls: typeof Base | ClassMeta | undefined) {
    return function<Prop extends string, Trg extends Base /* & Record<Prop, Map<number | string, T> | undefined>*/>(
        targetProto: Trg,
        prop: Prop
    ) {
        addField(targetProto, prop, hashType(Cls));
    };
}

export function hashType<T>(Class?: typeof Base | ClassMeta) {
    const elementClassMeta = buildElementClassMeta(Class);
    return new ClassMeta((json, prev) => HashMap.factory(elementClassMeta, json, prev as HashMap), undefined);
}
