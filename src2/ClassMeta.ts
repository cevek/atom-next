import { createField, Field } from './Field';
import { EntityClass, This } from './Entity';

export interface Reducer {
    name: string;
    reducer: Function;
}

export class ClassMeta {
    fields: Field[] = [];
    reducers: Reducer[] = [];
    constructor(public factory: (json: any, prevValue: any) => any) {}
}

export function getOrCreateField(classMeta: ClassMeta, name: string, fieldClassMeta: ClassMeta | undefined) {
    let field = classMeta.fields.filter(field => field.name === name).pop();
    if (field === undefined) {
        field = createField(name, fieldClassMeta);
        classMeta.fields.push(field);
    }
    return field;
}


export function getOrCreateClassMeta(Class: EntityClass, factory: (json: any, prevValue: any) => any) {
    let classMeta = Class.prototype._classMeta;
    if (classMeta === undefined) {
        classMeta = Class.prototype._classMeta = new ClassMeta(factory);
    }
    return classMeta;
}

export function getClassMetaFromObject(obj: any) {
    if (obj instanceof Object) {
        const Class = obj.constructor;
        if (Class instanceof Function) {
            return (Class.prototype as This)._classMeta;
        }
    }
    return;
}
export function getClassMetaOrThrow(Class: EntityClass) {
    let classMeta = Class.prototype._classMeta;
    if (classMeta === undefined) {
        throw new Error(`Class ${Class.name} is not registered`);
    }
    return classMeta;
}
