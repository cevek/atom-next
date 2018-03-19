import { reflectClass, ReflectClassResult } from './ReflectClass';
import { Atom, AtomCalc, AtomValue } from './Atom';
import { attachObject, clearParentsJson, TreeMeta } from './TreeMeta';
import { EntityClass, This } from './Entity';
import { createActionFactory } from './CreateActionFactory';
import { arrayFactory, ArrayProxy } from './Array';
import { ClassMeta, getClassMetaOrThrow, getOrCreateClassMeta, getOrCreateField, transformValue } from './ClassMeta';
import { checkWeAreInAction, toJSON } from './Utils';
import { factoryMap, HashMap } from './HashMap';
import { glob } from './Glob';
import { createField } from './Field';

function setPropsGetters(Target: Function, classMeta: ClassMeta, props: string[]) {
    for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        const field = getOrCreateField(classMeta, prop, undefined);
        Object.defineProperty(Target.prototype, prop, {
            get: function(this: This) {
                let treeMeta = this._treeMeta;
                return treeMeta.atoms[prop].get();
            },
            set: function(this: This, value: {}) {
                let treeMeta = this._treeMeta;
                if (typeof treeMeta === 'undefined') {
                    treeMeta = this._treeMeta = new TreeMeta();
                }
                let atom = treeMeta.atoms[prop] as AtomValue | undefined;
                const prevValue = atom === undefined ? undefined : atom.get();
                value = transformValue(field, value, prevValue);
                if (typeof atom === 'undefined') {
                    treeMeta.atoms[prop] = atom = new AtomValue(value);
                } else {
                    checkWeAreInAction();
                }
                attachObject(this, value);
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
        if (item.type === 'getter' && item.value) {
            const method = item.value as () => {};
            Object.defineProperty(Target.prototype, prop, {
                get: function(this: This) {
                    let treeMeta = this._treeMeta;
                    let atom = (treeMeta.atoms[prop] as Atom) as AtomCalc;
                    if (typeof atom === 'undefined') atom = new AtomCalc(this, method);
                    return atom.get();
                },
            });
        } else if (item.type === 'method') {
            const reducerName = Target.name + '.' + prop;
            classMeta.reducers.push({ name: reducerName, reducer: item.value });
            Target.prototype[prop] = createActionFactory(reducerName, item.value);
        }
    }
    Target.prototype.toJSON = function(this: This) {
        const treeMeta = this._treeMeta;
        if (treeMeta === undefined) return {};
        const classMeta = this._classMeta;
        if (treeMeta.json !== undefined) return treeMeta.json;
        const json = {};
        for (let i = 0; i < classMeta.fields.length; i++) {
            const field = classMeta.fields[i];
            json[field.name] = toJSON(this[field.name]);
        }
        treeMeta.json = json;
        return json;
    };
}

export function entity<Class extends new () => {}>(target: Class): Class {
    const Target = (target as {}) as EntityClass;
    const { prototype, props } = reflectClass(Target);
    const classMeta = getOrCreateClassMeta(Target, undefined!);
    classMeta.factory = (json, prev) => factoryEntity(Target, json, prev as This);
    Target.prototype._classMeta = classMeta;
    setPropsGetters(Target, classMeta, props);
    setMethods(Target, classMeta, prototype);
    return target;
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

export function sub<T>(Cls: new () => T) {
    return function<Prop extends string, Trg extends Record<Prop, T | undefined>>(targetProto: Trg, prop: Prop) {
        const Class = (Cls as {}) as EntityClass;
        const Target = targetProto.constructor as EntityClass;

        const subClassMeta = getClassMetaOrThrow(Class);
        const classMeta = getOrCreateClassMeta(Target, undefined!);
        const field = createField(prop, subClassMeta);
        classMeta.fields.push(field);
    };
}

function factoryEntity(Target: EntityClass, json: {}, prev: {} | undefined) {
    const prevInTransaction = glob.inTransaction;
    try {
        glob.inTransaction = true;
        if (prev === undefined) {
            prev = new Target();
        }
        // const treeMeta = prev._treeMeta;
        const classMeta = (prev as This)._classMeta;
        for (let i = 0; i < classMeta.fields.length; i++) {
            const field = classMeta.fields[i];
            prev[field.name] = json[field.name];
        }
        // treeMeta.json = json;
        return prev;
    } finally {
        glob.inTransaction = prevInTransaction;
    }
}
