import { ClassMeta } from './ClassMeta';

/** @internal */
export interface Field {
    name: string | number;
    skipped: boolean;
    readonly: boolean;
    classMeta: ClassMeta | undefined;
}
/** @internal */
export function createField(prop: string | number, classMeta: ClassMeta | undefined): Field {
    return {
        name: prop,
        skipped: false,
        readonly: false,
        classMeta: classMeta,
    };
}
