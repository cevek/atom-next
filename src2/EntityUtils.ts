import { ClassMeta } from './ClassMeta';
import { Base } from './Entity';
import { arrayType, hashType, setCalcProp, setProp } from './Decorators';
import { createField, Field } from './Field';
import { ReflectClassResult } from './ReflectClass';
import { createActionFactory } from './CreateActionFactory';
import { refType } from './Ref';
import { hasOwn } from './Utils';

/** @internal */
export function getClassMetaOfEntity(Class: typeof Base) {
    const proto = Class.prototype as Base;
    if (!(proto instanceof Base)) {
        throw new Error('Class ' + Class.name + ' is not extended Base class');
    }
    let classMeta: ClassMeta | undefined = proto._classMeta;
    if (!hasOwn(proto, '_classMeta')) {
        if (classMeta === undefined) {
            classMeta = new ClassMeta({});
        } else {
            classMeta = classMeta.clone();
        }
        classMeta.setTransformer = (rootStore, json) => Class.create(json, rootStore);
        Class.prototype._classMeta = classMeta;
    }
    return classMeta;
}
/** @internal */
export function setPropsGetters(Target: typeof Base, classMeta: ClassMeta) {
    for (let i = 0; i < classMeta.fields.length; i++) {
        const field = classMeta.fields[i];
        setProp(Target, field);
    }
}
/** @internal */
export function setMethods(Target: typeof Base, classMeta: ClassMeta, prototype: ReflectClassResult['prototype']) {
    for (let i = 0; i < prototype.length; i++) {
        const item = prototype[i];
        const prop = item.name;
        const field = classMeta.fields.filter(field => field.name === prop).pop();
        if (field !== undefined && field.skipped) continue;
        if (item.type === 'getter' && item.value) {
            setCalcProp(Target, prop, item.value as () => {});
        } else if (item.type === 'method') {
            const reducerName = Target.name + '.' + prop;
            classMeta.actions.push({ name: reducerName, fun: item.value });
            Target.prototype[prop] = createActionFactory(reducerName, item.value);
        }
    }
}

export function sub<T>(Class: typeof Base) {
    return function<Prop extends string, Trg extends Base & Record<Prop, T | undefined>>(targetProto: Trg, prop: Prop) {
        addField(targetProto, prop, getClassMetaOfEntity(Class));
    };
}
/** @internal */
export function buildElementClassMeta(Class: typeof Base | ClassMeta | undefined) {
    return Class instanceof ClassMeta ? Class : Class === undefined ? undefined : getClassMetaOfEntity(Class);
}
/** @internal */
export function addField(targetProto: Base, prop: string, propClassMeta: ClassMeta | undefined): Field {
    const Target = targetProto.constructor as typeof Base;
    const hostClassMeta = getClassMetaOfEntity(Target);
    let field = hostClassMeta.fields.filter(field => field.name === prop).pop();
    if (field === undefined) {
        field = createField(prop, undefined);
        hostClassMeta.fields.push(field);
    }
    if (propClassMeta !== undefined) {
        field.classMeta = propClassMeta;
    }
    return field;
}

/** @internal */
export type GeneratedType = {
    type: string | typeof Base | GeneratedType;
    args?: GeneratedType[];
};

/** @internal */
export interface GeneratedField extends GeneratedType {
    name: string;
    readonly?: boolean;
}

/** @internal */
export function createPropClassMetaFromGenType(genType: GeneratedType | typeof Base | string): ClassMeta | undefined {
    let propClassMeta = undefined;
    if (typeof genType === 'string') return propClassMeta;
    if (typeof genType === 'function') return getClassMetaOfEntity(genType);
    if (typeof genType.type === 'function') {
        propClassMeta = getClassMetaOfEntity(genType.type);
    } else if (genType.type === 'Array') {
        propClassMeta = arrayType(createPropClassMetaFromGenType(genType.args![0]));
    } else if (genType.type === 'Map') {
        propClassMeta = hashType(createPropClassMetaFromGenType(genType.args![1]));
    } else if (genType.type === 'Ref') {
        if (typeof genType.args![0].type !== 'function') {
            throw new Error('Ref argument is not a class type');
        }
        propClassMeta = refType(genType.args![0].type as typeof Base);
    } else if (genType.type === undefined) {
        throw new Error('Cyclic dependency');
    }
    return propClassMeta;
}

/** @internal */
export type Methods<T> = { [P in keyof T]: T[P] extends Function ? P : never }[keyof T];
export type JSONType<T> = T extends object
    ? { id?: string | number | undefined } & {
          [P in Exclude<keyof T, Methods<T> | '_treeMeta' | '_classMeta' | 'atoms' | 'id'>]: JSONType<T[P]>
      }
    : T;
export type PartialJSONType<T> = T extends object
    ? { id?: string | number | undefined } & {
          [P in Exclude<keyof T, Methods<T> | '_treeMeta' | '_classMeta' | 'atoms' | 'id'>]?: PartialJSONType<T[P]>
      }
    : T;
// export type JSONTypeFromClass<T extends new () => {}, Excluded = never> = JSONType<InstanceType<T>, Excluded>;
/** @internal */
export function bindActions(instance: Base) {
    const classMeta = instance._classMeta;
    for (let i = 0; i < classMeta.actions.length; i++) {
        const action = classMeta.actions[i];
        instance[action.name] = action.fun.bind(instance);
    }
}
