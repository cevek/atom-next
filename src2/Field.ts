import { ClassMeta } from './ClassMeta';

export interface Field {
    name: string | number;
    classMeta: ClassMeta | undefined;
    subClassMeta: ClassMeta[];
}

export function createField(prop: string | number, classMeta: ClassMeta | undefined): Field {
    return {
        name: prop,
        classMeta: classMeta,
        subClassMeta: [],
    };
}
