import { ClassMeta } from './ClassMeta';

export interface Field {
    name: string;
    subClassMeta: ClassMeta[];
    hooks: {
        set: ((value: {}) => {}) | undefined;
    };
}

export function createField(prop: string): Field {
    return {
        name: prop,
        hooks: {
            set: undefined,
        },
        subClassMeta: [],
    };
}
