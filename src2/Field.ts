import { ClassMeta } from './ClassMeta';

export interface Field {
    name: string | number;
    skipped: boolean;
    classMeta: ClassMeta | undefined;
}

export function createField(prop: string | number, classMeta: ClassMeta | undefined): Field {
    return {
        name: prop,
        skipped: false,
        classMeta: classMeta,
    };
}
