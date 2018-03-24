import { getRootStore, TreeMeta } from './TreeMeta';
import { ClassMeta } from './ClassMeta';
import { reflectClass, ReflectClassResult } from './ReflectClass';
import { createActionFactory } from './CreateActionFactory';
import { toJSON } from './Utils';
import { addField, setCalcProp, setProp } from './Decorators';
import { AtomValue } from './Atom';

type Methods<T> = { [P in keyof T]: T[P] extends Function ? P : never }[keyof T];
export type JSONType<T, Excluded = never> = { id?: string | number | undefined } & {
    [P in Exclude<keyof T, Methods<T> | '_treeMeta' | '_classMeta' | 'atoms' | 'id' | Excluded>]: JSONType<T[P]>
};

let idCounter = 0;
export class Base {
    id: number | string = 'auto' + ++idCounter;
    // getUniqueId() {
    //     return this.constructor.name + '_' + this.id;
    // }
    _treeMeta = new TreeMeta();
    _classMeta!: ClassMeta;
    constructor() {
        this.validateClass();
    }

    validateClass() {
        const Class = this.constructor as typeof Base;
        const classMeta = this._classMeta;
        if (classMeta === undefined) {
            throw new Error('This class is not belongs to any other class');
        }
        if (!classMeta.finished) {
            classMeta.finished = true;
            const { prototype, props } = reflectClass(Class);
            setPropsGetters(Class, classMeta, props);
            setMethods(Class, classMeta, prototype);
        }
    }

    fromJSON(json: {}) {
        const classMeta = this._classMeta;
        // const treeMeta = prev._treeMeta;
        if (json !== undefined) {
            if (json['id']! == undefined) {
                this.id = json['id'];
            }
            for (let i = 0; i < classMeta.fields.length; i++) {
                const field = classMeta.fields[i];
                if (field.skipped) continue;
                this[field.name] = json[field.name];
            }
        }
    }
    get atoms() {
        return this._treeMeta.atoms as Record<keyof this, { reset: () => void }>;
    }
    static create<T extends typeof Base>(this: T, json?: JSONType<InstanceType<T>>, parent?: Base): InstanceType<T> {
        const Class = this;
        let instance: Base | undefined = undefined;
        if (parent !== undefined && json !== undefined) {
            const rootStore = getRootStore(parent._treeMeta);
            if (rootStore !== undefined && json.id !== undefined) {
                instance = rootStore.instances.get(Class, json.id);
            }
        }
        if (json instanceof Class) return json as InstanceType<T>;
        if (instance === undefined) {
            instance = new Class();
            // console.log('new ', Class.name, instance.id);
        }
        if (json !== undefined) {
            instance.fromJSON(json);
        }
        return instance as InstanceType<T>;
    }

    toJSON(): {} {
        const treeMeta = this._treeMeta;
        if (treeMeta.json !== undefined) return treeMeta.json;
        const json = {id: this.id};
        const classMeta = this._classMeta;
        for (let i = 0; i < classMeta.fields.length; i++) {
            const field = classMeta.fields[i];
            if (field.skipped) continue;
            const atom = this._treeMeta.atoms[field.name] as AtomValue | undefined;
            if (atom !== undefined) {
                json[field.name] = toJSON(atom.value);
            }
        }
        treeMeta.json = json;
        return json;
    }
}

export function getClassMetaOfEntity(Class: typeof Base) {
    const proto = Class.prototype as Base;
    if (!(proto instanceof Base)) {
        throw new Error('Class ' + Class.name + ' is not extended Base class');
    }
    let classMeta = proto._classMeta;
    if (classMeta === undefined) {
        classMeta = new ClassMeta({
            setTransformer: (parent, json) => Class.create(json, parent),
        });
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
