import { getRootStoreOrThrow, TreeMeta } from './TreeMeta';
import { ClassMeta } from './ClassMeta';
import { toJSON } from './Utils';
import { AtomValue } from './Atom';
import {
    addField,
    bindActions,
    createPropClassMetaFromGenType,
    GeneratedField,
    getClassMetaOfEntity,
    PartialJSONType,
    setMethods,
    setPropsGetters,
} from './EntityUtils';
import { RootStore } from './RootStore';
import { reflectClass } from './ReflectClass';

let idCounter = 0;
export class Base {
    /** @internal */
    _treeMeta = new TreeMeta();
    /** @internal */
    _classMeta!: ClassMeta;
    id: number | string = 'auto' + ++idCounter;
    getUniqueId() {
        return this.constructor.name + '_' + this.id;
    }
    constructor() {
        this.validateClass();
        bindActions(this);
    }
    /** @internal */
    protected validateClass() {
        const Class = this.constructor as typeof Base;
        const classMeta = getClassMetaOfEntity(Class);
        if (!classMeta.finished) {
            classMeta.finished = true;
            const { prototype, props } = reflectClass(Class);
            if (typeof Class.__fields === 'function') {
                const fields = Class.__fields();
                for (let i = 0; i < fields.length; i++) {
                    const genField = fields[i];
                    const field = addField(
                        Class.prototype,
                        genField.name,
                        createPropClassMetaFromGenType(genField.type)
                    );
                    // field.readonly = !!genField.readonly;
                }
            } else {
                for (let i = 0; i < props.length; i++) {
                    const prop = props[i];
                    addField(Class.prototype, prop, undefined);
                }
            }
            setPropsGetters(Class, classMeta);
            setMethods(Class, classMeta, prototype);
        }
    }

    getById(Class: typeof Base, id: string | number) {
        const rootStore = getRootStoreOrThrow(this._treeMeta);
        return rootStore.instances.get(Class, id);
    }

    getByIdOrThrow(Class: typeof Base, id: string | number) {
        const rootStore = getRootStoreOrThrow(this._treeMeta);
        return rootStore.instances.getOrThrow(Class, id);
    }

    /** @internal */
    __fromJSON(json: PartialJSONType<this>, partial = false) {
        const classMeta = this._classMeta;
        // const treeMeta = prev._treeMeta;
        if (json !== undefined) {
            const id = json['id'];
            if (id !== undefined) {
                this.id = id;
            }
            for (let i = 0; i < classMeta.fields.length; i++) {
                const field = classMeta.fields[i];
                if (field.skipped) continue;
                if (partial && !json.hasOwnProperty(field.name)) continue;
                this[field.name] = json[field.name];
            }
        }
    }
    get atoms() {
        return this._treeMeta.atoms as Record<keyof this, { reset: () => void }>;
    }
    static create<T extends typeof Base>(
        this: T,
        json?: PartialJSONType<InstanceType<T>>,
        rootStore?: RootStore
    ): InstanceType<T> {
        const Class = this;
        let instance: Base | undefined = undefined;
        if (rootStore !== undefined && json !== undefined && json.id !== undefined) {
            instance = rootStore.instances.get(Class, json.id);
        }
        if (json instanceof Class) return json as InstanceType<T>;
        if (instance === undefined) {
            instance = new Class();
            // console.log('new ', Class.name, instance.id);
        }
        if (json !== undefined) {
            instance.__fromJSON(json);
        }
        return instance as InstanceType<T>;
    }

    toJSON(): {} {
        const treeMeta = this._treeMeta;
        if (treeMeta.json !== undefined) return treeMeta.json;
        const json = { id: this.id };
        const classMeta = this._classMeta;
        for (let i = 0; i < classMeta.fields.length; i++) {
            const field = classMeta.fields[i];
            if (field.skipped) continue;
            const atom = this._treeMeta.atoms[field.name] as AtomValue | undefined;
            json[field.name] = toJSON(atom === undefined ? this[field.name] : atom.value);
        }
        treeMeta.json = json;
        return json;
    }

    /** @internal */
    static __fields?: () => GeneratedField[];
}
