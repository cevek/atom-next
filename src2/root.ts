import { reflectClass, ReflectClassResult } from './ReflectClass';
import { AtomCalc, AtomValue } from '../src/atom';
import { attach, clearParentsJson, getRootStore, TreeMeta } from './TreeMeta';
import { Reducer, This } from './utils';
import { RootStore } from './RootStore';
import { Field } from './Field';
import { createActionFactory } from './CreateActionFactory';
import { ArrayProxy } from './Array';

function setValue(atom: AtomValue, treeMeta: TreeMeta, field: Field, value: any, key: string) {
    const isInitialization = true;
    let rootStore: RootStore | undefined = undefined!;
    if (isInitialization) {
        rootStore = getRootStore(treeMeta);
        if (rootStore === undefined) {
            throw new Error('Never possible');
        }
    }
    if (value instanceof Object) {
        const valueTreeMeta = (value as This)._treeMeta;
        if (valueTreeMeta !== undefined) {
            attach(treeMeta, key, valueTreeMeta);
            if (isInitialization) {
                const Class = value.constructor;
                field.Class = Class;
                rootStore._registerReducersFromClass(Class);
            }
        }
    }
    if (isInitialization && value instanceof BoxedValue) {
        const { Class, elementFactory } = value;
        field.Class = Class;
        field.elementFactory = elementFactory;
        if (Class !== undefined) {
            rootStore._registerReducersFromClass(value.Class);
        }
        if (elementFactory !== undefined) {
            rootStore!._registerReducersFromClass(elementFactory);
        }
        value = value.value;
    }
    if (atom.set(value)) {
        clearParentsJson(treeMeta);
    }
}

function setPropsGetters(Target: Function, props: string[]) {
    const fields: Field[] = [];
    (Target.prototype as This)._fields = fields;
    for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        const field = {
            name: prop,
            idx: i,
            Class: undefined,
            elementFactory: undefined,
        };
        fields.push(field);
        Object.defineProperty(Target.prototype, prop, {
            get: function(this: This) {
                let treeMeta = this._treeMeta;
                return treeMeta.atoms[prop].get();
            },
            set: function(this: This, value: any) {
                let treeMeta = this._treeMeta;
                let atom = treeMeta.atoms[prop] as AtomValue;
                if (typeof treeMeta === 'undefined') treeMeta = this._treeMeta = new TreeMeta();
                if (typeof atom === 'undefined') atom = new AtomValue(value);
                setValue(atom, treeMeta, field, value, prop);
            },
        });
    }
}

function setMethods(Target: Function, prototype: ReflectClassResult['prototype']) {
    const reducers: Reducer[] = [];
    (Target.prototype as This)._reducers = reducers;

    for (let i = 0; i < prototype.length; i++) {
        const item = prototype[i];
        const prop = item.name;
        if (item.type === 'getter' && item.get) {
            const method = item.get as () => {};
            Object.defineProperty(Target.prototype, prop, {
                get: function(this: This) {
                    let treeMeta = this._treeMeta;
                    let atom = treeMeta.atoms[prop];
                    if (typeof atom === 'undefined') atom = new AtomCalc(method);
                    return atom.get();
                },
            });
        } else if (item.type === 'method') {
            const reducerName = Target.name + '.' + prop;
            reducers.push({ name: reducerName, reducer: item.method });
            Target.prototype[prop] = createActionFactory(reducerName, item.method);
        }
    }
}

export function root<Class extends new () => {}>(target: Class): Class {
    const Target = (target as {}) as new () => {};
    const { prototype, props } = reflectClass(Target);
    setPropsGetters(Target, props);
    setMethods(Target, prototype);
    return target;
}

class BoxedValue {
    constructor(public Class: new () => {}, public elementFactory: (new () => {}) | undefined, public value: {}) {}
}

function boxValue<Value>(Class: new () => {}, BoxClass: (new () => {}) | undefined, value: Value): Value {
    return (new BoxedValue(Class, BoxClass, value) as {}) as Value;
}

export function array<Store>(Class: new () => Store): undefined | Store[];
export function array<Store>(Class: new () => Store, value: Store[]): Store[];
export function array<Store>(Class: new () => Store, value?: Store[]) {
    return boxValue(ArrayProxy, Class, value);
}

export function maybe<Store>(Class: new () => Store): undefined | Store;
export function maybe<Store>(Class: new () => Store, value: Store): Store;
export function maybe<Store>(Class: new () => Store, value?: Store) {
    return boxValue(Class, undefined, value);
}
