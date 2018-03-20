import { createField, Field } from './Field';
import { EntityClass, This } from './Entity';

export interface Reducer {
    name: string;
    reducer: Function;
}

export class ClassMeta {
    fields: Field[] = [];
    reducers: Reducer[] = [];
    constructor(public factory: (json: {}, prevValue: {} | undefined) => {}) {}
}

export function getOrCreateField(classMeta: ClassMeta, name: string, fieldClassMeta: ClassMeta | undefined) {
    let field = classMeta.fields.filter(field => field.name === name).pop();
    if (field === undefined) {
        field = createField(name, fieldClassMeta);
        classMeta.fields.push(field);
    }
    return field;
}

export function getOrCreateClassMeta(
    Class: EntityClass,
    factory: (json: {} | undefined, prevValue: {} | undefined) => {}
) {
    let classMeta = Class.prototype._classMeta;
    if (classMeta === undefined) {
        classMeta = Class.prototype._classMeta = new ClassMeta(factory);
    }
    return classMeta;
}

export function getClassMetaOrThrow(Class: EntityClass) {
    const classMeta = Class.prototype._classMeta;
    if (classMeta === undefined) {
        throw new Error(`Class ${Class.name} is not registered`);
    }
    return classMeta;
}

export function getClassMetaFromObj(obj: {} | undefined) {
    if (obj instanceof Object) {
        return (obj as This)._classMeta;
    }
}

export function transformValue<T>(valueField: Field, value: T, prevValue: T | undefined): T {
    // if (valueField.classMeta === undefined) {
    //     if (value instanceof Object) {
    //         valueField.classMeta = ((value as {}) as This)._classMeta;
    //     }
    // }
    if (valueField.classMeta !== undefined) {
        if (value === undefined || value === null) return value;
        return valueField.classMeta.factory(value, prevValue) as T;
    }
    return value;
}
