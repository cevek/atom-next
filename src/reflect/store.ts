// export interface Field {
//     name: string;
//     Class: StoreClass | undefined;
//     BoxClass: StoreClass | undefined;
// }

import { actionCreatorFactory, Field, getValue, setValue, Target } from '../AtomTree';
import { AtomProxy } from '../AtomProxy';
import { ArrayProxy } from '../ArrayAtomTree';

class Meta<Store = {}, BoxStore = {}, Value = {}> {
    constructor(
        public Class: typeof AtomProxy,
        public elementFactory: typeof AtomProxy | undefined,
        public value: Value
    ) {}
}

// function handleInstance(Store: typeof AtomProxy, instance: AtomProxy) {
//     const fields = Store.prototype._fields;
//     const keys = Object.keys(instance) as (keyof typeof instance)[];
//     for (let i = 0; i < keys.length; i++) {
//         const key = keys[i];
//         if (key[0] === '_') continue;
//         const value = instance[key];
//         const valueCtor =
//             typeof value === 'object' && value !== null && value.constructor ? value.constructor : undefined;
//         let Class;
//         let elementFactory;
//         if (value instanceof Meta) {
//             instance[key] = value.value;
//             Class = value.Class;
//             elementFactory = value.elementFactory;
//         } else if (
//             valueCtor === undefined ||
//             valueCtor === Number ||
//             valueCtor === String ||
//             valueCtor === Boolean ||
//             valueCtor === Symbol
//         ) {
//         } else {
//             Class = valueCtor as typeof AtomProxy;
//         }
//         const idx = fields.length;
//         fields.push({
//             name: key,
//             Class,
//             elementFactory,
//         });
//         Object.defineProperty(Store.prototype, key, {
//             get: function(this: AtomProxy) {
//                 return getValue(this, idx);
//             },
//             set: function(this: AtomProxy, value: Target) {
//                 setValue(this, idx, key, value);
//             },
//         });
//     }
// }

function parseFieldsFromCtor(StoreClass: Function) {
    //https://stackoverflow.com/a/2008444/1024431
    const source = StoreClass.toString();
    const re = /this\.([_$a-zA-Z\xA0-\uFFFF].*?)(?=[^_$a-zA-Z0-9\xA0-\uFFFF])/g;
    let m;
    let keyMap: { [key: string]: boolean } = {};
    while ((m = re.exec(source))) {
        keyMap[m[1]] = true;
    }
    return Object.keys(keyMap);
}

function handlePrototype<Store>(originalTarget: Function, StoreClass: typeof AtomProxy) {
    const keys = parseFieldsFromCtor(originalTarget);
    const fields = [];
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const field: Field = {
            idx: i,
            name: key,
            Class: undefined,
            elementFactory: undefined,
        };
        fields.push(field);
        Object.defineProperty(StoreClass.prototype, key, {
            get: function(this: AtomProxy) {
                return getValue(this, field);
            },
            set: function(this: AtomProxy, value: Target) {
                if (value instanceof Meta) {
                    field.Class = value.Class;
                    field.elementFactory = value.elementFactory;
                    if (value.Class !== undefined) {
                        this._rootStore!._registerReducersFromClass(value.Class);
                    }
                    if (value.elementFactory !== undefined) {
                        this._rootStore!._registerReducersFromClass(value.elementFactory);
                    }
                    value = value.value;
                } else if (value instanceof AtomProxy) {
                    field.Class = value.constructor as typeof AtomProxy;
                }
                setValue(this, field, value);
            },
        });
    }
    StoreClass.prototype._fields = fields;
    const prototypeKeys = Object.getOwnPropertyNames(StoreClass.prototype) as (
        | keyof typeof StoreClass.prototype
        | 'constructor')[];
    for (let i = 0; i < prototypeKeys.length; i++) {
        const key = prototypeKeys[i];
        if (key === 'constructor' || key[0] === '_') continue;
        const descriptor = Object.getOwnPropertyDescriptor(StoreClass.prototype, key)!;
        if (descriptor.get !== undefined) {
        } else if (typeof descriptor.value === 'function') {
            const reducerName = StoreClass.displayName + '.' + key;
            // instance._rootStore!._reducers.set(reducerName, descriptor.value);
            StoreClass.prototype[key] = actionCreatorFactory(reducerName, descriptor.value);
        }
    }
}

// let currentHostFields: Field[] | undefined = undefined;

function a<A>(a: A) {
    return a;
}

const defaultFields = AtomProxy.prototype._fields;
export function root<Class extends new () => {}>(target: Class): Class {
    const Store = (function(this: AtomProxy) {
        AtomProxy.call(this);
        // let prevHostFields = currentHostFields;
        // if (Store.prototype._fields === defaultFields) {
        //     currentHostFields = [];
        // }
        target.apply(this, arguments);
        // if (currentHostFields !== undefined) {
        //     Store.prototype._fields = currentHostFields;
        //     handleInstance(Store, this);
        // }
        // currentHostFields = prevHostFields;
    } as {}) as typeof AtomProxy;
    Store.displayName = target.name;
    const targetPrototype = target.prototype;
    target.prototype = Object.create(AtomProxy.prototype);
    Store.prototype = Object.create(target.prototype);
    const keys = Object.getOwnPropertyNames(targetPrototype);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i] as keyof typeof Store.prototype;
        Store.prototype[key] = targetPrototype[key];
    }
    Store.prototype.constructor = Store;
    handlePrototype(target, Store);
    Object.setPrototypeOf(Store, target);
    return (Store as {}) as Class;
}

function meta<Value>(Class: new () => {}, BoxClass: (new () => {}) | undefined, value: Value): Value {
    // if (currentHostFields !== undefined) {

    // }
    return (new Meta(Class as typeof AtomProxy, BoxClass as typeof AtomProxy, value) as {}) as Value;
    // return value;
}

export function array<Store>(Class: new () => Store): undefined | Store[];
export function array<Store>(Class: new () => Store, value: Store[]): Store[];
export function array<Store>(Class: new () => Store, value?: Store[]) {
    return meta(ArrayProxy, Class, value);
}

export function maybe<Store>(Class: new () => Store): undefined | Store;
export function maybe<Store>(Class: new () => Store, value: Store): Store;
export function maybe<Store>(Class: new () => Store, value?: Store) {
    return meta(Class, undefined, value);
}
