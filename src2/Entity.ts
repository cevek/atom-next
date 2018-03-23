import { TreeMeta } from './TreeMeta';
import { ClassMeta } from './ClassMeta';
import { reflectClass, ReflectClassResult } from './ReflectClass';
import { createActionFactory } from './CreateActionFactory';
import { toJSON } from './Utils';
import { addField, setCalcProp, setProp } from './Decorators';

type Methods<T> = { [P in keyof T]: T[P] extends Function ? P : never }[keyof T];
export type JSONType<T, Excluded = never> = { id?: string | number | undefined } & {
    [P in Exclude<keyof T, Methods<T> | '_treeMeta' | '_classMeta' | 'atoms' | 'id' | Excluded>]: JSONType<T[P]>
};
// let idCounter = 0;
export class Base {
    _treeMeta = new TreeMeta();
    _classMeta!: ClassMeta;
    constructor() {}
    get atoms() {
        return this._treeMeta.atoms as Record<keyof this, { reset: () => void }>;
    }
    static create<T extends typeof Base>(this: T, json?: JSONType<InstanceType<T>>, prev?: InstanceType<T>) {
        let instance = prev as Base | undefined;
        let classMeta = this.prototype._classMeta;
        if (classMeta === undefined) {
            throw new Error('This class is not belongs to any other class');
        }
        if (!classMeta.finished) {
            classMeta.finished = true;
            const { prototype, props } = reflectClass(this);
            setPropsGetters(this, classMeta, props);
            setMethods(this, classMeta, prototype);
        }
        return applyJsonToEntity(this, json, instance) as InstanceType<T>;
    }

    toJSON() {
        const treeMeta = this._treeMeta;
        if (treeMeta.json !== undefined) return treeMeta.json;
        const json = {};
        const classMeta = this._classMeta;
        for (let i = 0; i < classMeta.fields.length; i++) {
            const field = classMeta.fields[i];
            if (field.skipped) continue;
            json[field.name] = toJSON(this[field.name]);
        }
        treeMeta.json = json;
        return json;
    }
}

export function applyJsonToEntity(Class: typeof Base, json: {} | undefined, instance: Base | undefined) {
    if (json instanceof Class) return json;
    // const prevInTransaction = glob.inTransaction;
    // try {
    // glob.inTransaction = true;
    if (instance === undefined) {
        instance = new Class() as Base;
    }
    const classMeta = instance._classMeta;
    // const treeMeta = prev._treeMeta;
    if (json !== undefined) {
        if (json['id'] !== undefined) {
            instance._treeMeta.id = json['id'];
        }
        for (let i = 0; i < classMeta.fields.length; i++) {
            const field = classMeta.fields[i];
            if (field.skipped) continue;
            instance[field.name] = json[field.name];
        }
    }
    return instance;
}

export function getClassMetaOfEntity(Class: typeof Base) {
    const proto = Class.prototype as Base;
    if (!(proto instanceof Base)) {
        throw new Error('Class ' + Class.name + ' is not extended Base class');
    }
    let classMeta = proto._classMeta;
    if (classMeta === undefined) {
        classMeta = new ClassMeta((json, prev) => Class.create(json, prev as Base));
        Class.prototype._classMeta = classMeta;
    }
    return classMeta;
}

function setPropsGetters(Target: typeof Base, classMeta: ClassMeta, props: string[]) {
    for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        addField(Target.prototype, prop, undefined);
    }
    for (let i = 0; i < classMeta.fields.length; i++) {
        const field = classMeta.fields[i];
        setProp(Target, field);
    }
}

function setMethods(Target: typeof Base, classMeta: ClassMeta, prototype: ReflectClassResult['prototype']) {
    for (let i = 0; i < prototype.length; i++) {
        const item = prototype[i];
        const prop = item.name;
        const field = classMeta.fields.filter(field => field.name === prop).pop();
        if (field !== undefined && field.skipped) continue;
        if (item.type === 'getter' && item.value) {
            setCalcProp(Target, prop, item.value as () => {});
        } else if (item.type === 'method') {
            const reducerName = Target.name + '.' + prop;
            classMeta.reducers.push({ name: reducerName, reducer: item.value });
            Target.prototype[prop] = createActionFactory(reducerName, item.value);
        }
    }
}
