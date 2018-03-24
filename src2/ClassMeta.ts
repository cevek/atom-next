import { createField, Field } from './Field';
import { Base } from './Entity';

export interface Reducer {
    name: string;
    reducer: Function;
}

export class ClassMeta {
    fields: Field[];
    reducers: Reducer[];
    finished: boolean;
    setTransformer: ((parent: Base, json: {}, prevValue: {} | undefined) => {}) | undefined;
    getTransformer: ((parent: Base, value: {}) => {} | undefined) | undefined;
    constructor({ getTransformer, setTransformer, reducers = [], finished = false, fields = [] }: Partial<ClassMeta>) {
        this.fields = fields;
        this.reducers = reducers;
        this.finished = finished;
        this.setTransformer = setTransformer;
        this.getTransformer = getTransformer;
    }
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

export function setTransformValue<T>(parent: Base, valueField: Field, value: T, prevValue: T | undefined): T {
    if (value === null || typeof value !== 'object') return value;
    if (valueField.classMeta !== undefined && valueField.classMeta.setTransformer !== undefined) {
        return valueField.classMeta.setTransformer(parent, value, prevValue) as T;
    }
    return value;
}

export function getTransformValue<T>(parent: Base, valueField: Field, value: T): T {
    if (valueField.classMeta !== undefined && valueField.classMeta.getTransformer !== undefined) {
        return valueField.classMeta.getTransformer(parent, value) as T;
    }
    return value;
}
