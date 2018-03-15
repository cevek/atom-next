import { reflectClass, ReflectClassResult } from './ReflectClass';
import { AtomCalc, AtomValue } from '../src/atom';
import { attachObject, TreeMeta } from './TreeMeta';
import { EntityClass, EntityClassPublic, This } from './Entity';
import { createActionFactory } from './CreateActionFactory';
import { ArrayProxy } from './Array';
import { ClassMeta, getClassMetaOrThrow, getOrCreateClassMeta, getOrCreateField } from './ClassMeta';
import { toJSON } from './utils';

function setPropsGetters(Target: Function, classMeta: ClassMeta, props: string[]) {
    for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        const field = getOrCreateField(classMeta, prop);
        Object.defineProperty(Target.prototype, prop, {
            get: function(this: This) {
                let treeMeta = this._treeMeta;
                return treeMeta.atoms[prop].get();
            },
            set: function(this: This, value: any) {
                let treeMeta = this._treeMeta;
                if (typeof treeMeta === 'undefined') {
                    treeMeta = this._treeMeta = new TreeMeta();
                }
                let atom = treeMeta.atoms[prop] as AtomValue;
                if (typeof atom === 'undefined') {
                    treeMeta.atoms[prop] = atom = new AtomValue(value);
                }
                if (field.hooks.set !== undefined) {
                    value = field.hooks.set(value);
                }
                attachObject(this, prop, value);
                atom.set(value);
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
                    let atom = treeMeta.atoms[prop];
                    if (typeof atom === 'undefined') atom = new AtomCalc(method);
                    return atom.get();
                },
            });
        } else if (item.type === 'method') {
            const reducerName = Target.name + '.' + prop;
            classMeta.reducers.push({ name: reducerName, reducer: item.value });
            Target.prototype[prop] = createActionFactory(reducerName, item.value);
        }
    }
    Target.prototype.toJSON = function() {
        return toJSON(this);
    };
}

export function entity<Class extends EntityClassPublic>(target: Class): Class {
    const Target = target as EntityClass;
    const { prototype, props } = reflectClass(Target);
    const classMeta = getOrCreateClassMeta(Target);
    Target.prototype._classMeta = classMeta;
    setPropsGetters(Target, classMeta, props);
    setMethods(Target, classMeta, prototype);

    return target;
}

export function array<T>(fn: new () => T) {
    return function<Prop extends string, Trg extends Record<Prop, T[] | undefined>>(targetProto: Trg, prop: Prop) {
        const Target = targetProto.constructor as EntityClass;
        const classMeta = getOrCreateClassMeta(Target);
        const field = getOrCreateField(classMeta, prop);

        const fnClassMeta = getClassMetaOrThrow((fn as {}) as EntityClass);
        field.subClassMeta.push(fnClassMeta);
        field.hooks.set = (arr: any) => new ArrayProxy(fnClassMeta, arr);
    };
}

export function sub<T>(fn: new (...args: any[]) => T) {
    return function<Prop extends string, Trg extends Record<Prop, T | undefined>>(targetProto: Trg, prop: Prop) {
        const Target = targetProto.constructor as EntityClass;
        const classMeta = getOrCreateClassMeta(Target);
        const field = getOrCreateField(classMeta, prop);

        const fnClassMeta = getClassMetaOrThrow((fn as {}) as EntityClass);
        field.subClassMeta.push(fnClassMeta);
        field.hooks.set = (val: any) => new fn(val);
    };
}
