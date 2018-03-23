import { createField, Field } from './Field';
import { Base } from './Entity';

export interface Reducer {
    name: string;
    reducer: Function;
}

export class ClassMeta {
    fields: Field[] = [];
    reducers: Reducer[] = [];
    finished = false;
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

export function getClassMetaFromObj(obj: {} | undefined) {
    if (obj instanceof Object) {
        return (obj as Base)._classMeta;
    }
}

export function transformValue<T>(valueField: Field, value: T, prevValue: T | undefined): T {
    // if (valueField.classMeta === undefined) {
    //     if (value instanceof Object) {
    //         valueField.classMeta = ((value as {}) as This)._classMeta;
    //     }
    // }
    if (value === null || typeof value !== 'object') return value;
    if (valueField.classMeta !== undefined) {
        return valueField.classMeta.factory(value, prevValue) as T;
    }
    return value;
}
