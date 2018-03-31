import { createField, Field } from './Field';
import { Base } from './Entity';
import { RootStore } from './RootStore';

/** @internal */
export interface Action {
    name: string;
    fun: Function;
}
export class ClassMeta {
    /** @internal */
    fields: Field[];
    /** @internal */
    actions: Action[];
    /** @internal */
    finished: boolean;
    /** @internal */
    setTransformer: ((rootStore: RootStore | undefined, json: {}, prevValue: {} | undefined) => {}) | undefined;
    /** @internal */
    getTransformer: ((rootStore: RootStore | undefined, value: {}) => {} | undefined) | undefined;
    /** @internal */
    constructor({ getTransformer, setTransformer, actions = [], finished = false, fields = [] }: Partial<ClassMeta>) {
        this.fields = fields;
        this.actions = actions;
        this.finished = finished;
        this.setTransformer = setTransformer;
        this.getTransformer = getTransformer;
    }
}
/** @internal */
export function getOrCreateField(classMeta: ClassMeta, name: string, fieldClassMeta: ClassMeta | undefined) {
    let field = classMeta.fields.filter(field => field.name === name).pop();
    if (field === undefined) {
        field = createField(name, fieldClassMeta);
        classMeta.fields.push(field);
    }
    return field;
}
/** @internal */
export function getClassMetaFromObj(obj: {} | undefined) {
    if (obj instanceof Object) {
        return (obj as Base)._classMeta;
    }
}
/** @internal */
export function setTransformValue<T>(
    rootStore: RootStore | undefined,
    valueField: Field,
    value: T,
    prevValue: T | undefined
): T {
    if (value === null || typeof value !== 'object') return value;
    if (valueField.classMeta !== undefined && valueField.classMeta.setTransformer !== undefined) {
        return valueField.classMeta.setTransformer(rootStore, value, prevValue) as T;
    }
    return value;
}
/** @internal */
export function getTransformValue<T>(rootStore: RootStore | undefined, valueField: Field, value: T): T {
    if (valueField.classMeta !== undefined && valueField.classMeta.getTransformer !== undefined) {
        return valueField.classMeta.getTransformer(rootStore, value) as T;
    }
    return value;
}
