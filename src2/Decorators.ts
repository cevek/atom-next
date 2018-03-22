import { reflectClass, ReflectClassResult } from './ReflectClass';
import { Atom, AtomCalc, AtomValue } from './Atom';
import { attachObject, clearParentsJson, TreeMeta } from './TreeMeta';
import { EntityClass, This } from './Entity';
import { createActionFactory } from './CreateActionFactory';
import { ClassMeta, getClassMetaOrThrow, getOrCreateClassMeta, getOrCreateField, transformValue } from './ClassMeta';
import { checkWeAreInAction, toJSON } from './Utils';
import { glob } from './Glob';
import { createField } from './Field';
import { KeyedAtomCalc } from './KeyedAtomCalc';

function setPropsGetters(Target: Function, classMeta: ClassMeta, props: string[]) {
    for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        const field = getOrCreateField(classMeta, prop, undefined);
        if (field.skipped) continue;
        Object.defineProperty(Target.prototype, prop, {
            get: function(this: This) {
                let treeMeta = this._treeMeta;
                let atom = treeMeta.atoms[prop] as AtomValue;
                if (atom === undefined) {
                    return undefined;
                }
                return atom.get();
            },
            set: function(this: This, value: {}) {
                let treeMeta = this._treeMeta;
                if (typeof treeMeta === 'undefined') {
                    treeMeta = this._treeMeta = new TreeMeta();
                }
                let atom = treeMeta.atoms[prop] as AtomValue | undefined;
                const prevValue = atom === undefined ? undefined : atom.value;
                value = transformValue(field, value, prevValue);
                if (typeof atom === 'undefined') {
                    treeMeta.atoms[prop] = atom = new AtomValue(value, Target.name + '.' + prop);
                } else {
                    checkWeAreInAction();
                }
                attachObject(this, value, prevValue);
                atom.set(value);
                clearParentsJson(treeMeta);
            },
        });
    }
}

function setMethods(Target: Function, classMeta: ClassMeta, prototype: ReflectClassResult['prototype']) {
    for (let i = 0; i < prototype.length; i++) {
        const item = prototype[i];
        const prop = item.name;
        const field = classMeta.fields.filter(field => field.name === prop).pop();
        if (field !== undefined && field.skipped) continue;
        if (item.type === 'getter' && item.value) {
            const method = item.value as () => {};
            Object.defineProperty(Target.prototype, prop, {
                get: function(this: This) {
                    let treeMeta = this._treeMeta;
                    let atom = (treeMeta.atoms[prop] as Atom) as AtomCalc;
                    if (typeof atom === 'undefined') {
                        treeMeta.atoms[prop] = atom = new AtomCalc(this, method, Target.name + '.' + prop + '()');
                    }
                    return atom.get();
                },
            });
        } else if (item.type === 'method') {
            const reducerName = Target.name + '.' + prop;
            classMeta.reducers.push({ name: reducerName, reducer: item.value });
            Target.prototype[prop] = createActionFactory(reducerName, item.value);
        }
    }
    const toJSON = typeof Target.prototype.toJSON === 'function' ? Target.prototype.toJSON : entityToJSON;
    Target.prototype.toJSON = function(this: This) {
        const treeMeta = this._treeMeta;
        if (treeMeta === undefined) return {};
        if (treeMeta.json !== undefined) return treeMeta.json;
        const json = toJSON.call(this);
        treeMeta.json = json;
        return json;
    };
}

export function entityToJSON(this: This) {
    const json = {};
    const classMeta = this._classMeta;
    for (let i = 0; i < classMeta.fields.length; i++) {
        const field = classMeta.fields[i];
        if (field.skipped) continue;
        json[field.name] = toJSON(this[field.name]);
    }
    return json;
}

export function entity<Class extends EntityClass>(Target: Class): Class {
    const { prototype, props } = reflectClass(Target);
    const classMeta = getOrCreateClassMeta(Target, undefined!);
    classMeta.factory = (json, prev) => factoryEntity(Target, json, prev as This);
    (Target.prototype as This)._classMeta = classMeta;
    setPropsGetters(Target, classMeta, props);
    setMethods(Target, classMeta, prototype);
    return Target;
}

export function sub<T>(Class: EntityClass<T>) {
    return function<Prop extends string, Trg extends Record<Prop, T | undefined>>(targetProto: Trg, prop: Prop) {
        addField(targetProto, prop, getClassMetaOrThrow(Class));
    };
}
export function key<Prop extends string, Host extends Record<Prop, (key: number) => {} | undefined>>(
    target: Host,
    prop: Prop
): any;
export function key<Prop extends string, Host extends Record<Prop, (key: string) => {} | undefined>>(
    target: Host,
    prop: Prop
): any;
export function key(targetProto: {}, prop: string) {
    const fn = targetProto[prop];
    Object.defineProperty(targetProto, prop, {
        value: function(this: This, key: string | number | undefined) {
            let treeMeta = this._treeMeta;
            if (treeMeta === undefined) {
                treeMeta = this._treeMeta = new TreeMeta();
            }
            let keyedAtom = treeMeta.atoms[prop] as KeyedAtomCalc;
            if (keyedAtom === undefined) {
                treeMeta.atoms[prop] = keyedAtom = new KeyedAtomCalc(this, fn);
            }
            return keyedAtom.get(key);
        },
    });
}

export function skip<T>(targetProto: {}, prop: string) {
    const Target = targetProto.constructor as EntityClass;
    const classMeta = getOrCreateClassMeta(Target, undefined!);
    const field = createField(prop, undefined);
    field.skipped = true;
    classMeta.fields.push(field);
}

export function factoryEntity(Target: EntityClass, json: {} | undefined, prev: {} | undefined) {
    const prevInTransaction = glob.inTransaction;
    if (json instanceof Target) return json;
    try {
        glob.inTransaction = true;
        if (prev === undefined) {
            prev = new Target();
        }
        // const treeMeta = prev._treeMeta;
        if (json !== undefined) {
            const classMeta = (prev as This)._classMeta;
            for (let i = 0; i < classMeta.fields.length; i++) {
                const field = classMeta.fields[i];
                if (field.skipped) continue;
                prev[field.name] = json[field.name];
            }
        }
        // treeMeta.json = json;
        return prev;
    } finally {
        glob.inTransaction = prevInTransaction;
    }
}

export function buildElementClassMeta(Class: EntityClass | ClassMeta | undefined) {
    return Class instanceof ClassMeta ? Class : Class === undefined ? undefined : getClassMetaOrThrow(Class);
}
export function addField(targetProto: {}, prop: string, propClassMeta: ClassMeta) {
    const Target = targetProto.constructor as EntityClass;
    const hostClassMeta = getOrCreateClassMeta(Target, undefined!);
    const field = createField(prop, propClassMeta);
    hostClassMeta.fields.push(field);
}
