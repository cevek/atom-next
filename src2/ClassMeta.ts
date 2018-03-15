import { createField, Field } from './Field';
import { EntityClass } from './Entity';

export interface Reducer {
    name: string;
    reducer: Function;
}

export class ClassMeta {
    fields: Field[] = [];
    reducers: Reducer[] = [];
}

export function getOrCreateField(classMeta: ClassMeta, name: string) {
    let field = classMeta.fields.filter(field => field.name === name).pop();
    if (field === undefined) {
        field = createField(name);
        classMeta.fields.push(field);
    }
    return field;
}

export function getOrCreateClassMeta(Class: EntityClass) {
    let classMeta = Class.prototype._classMeta;
    if (classMeta === undefined) {
        classMeta = Class.prototype._classMeta = new ClassMeta();
    }
    return classMeta;
}
export function getClassMetaOrThrow(Class: EntityClass) {
    let classMeta = Class.prototype._classMeta;
    if (classMeta === undefined) {
        throw new Error(`Class ${Class.name} is not registered`);
    }
    return classMeta;
}
