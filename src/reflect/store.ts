export interface Field {
    name: string;
    Class: StoreClass | undefined;
    BoxClass: StoreClass | undefined;
}

export interface StoreClass<Store = {}> {
    new (): Store;
    meta?: {
        fields: Field[];
        methods: (() => void)[];
        getters: (() => void)[];
    };
}

class Meta<Store = {}, BoxStore = {}, Value = {}> {
    constructor(
        public Class: StoreClass<Store>,
        public BoxClass: StoreClass<BoxStore> | undefined,
        public value: Value
    ) {}
}

function handleInstance<Store>(Store: StoreClass<Store>, instance: Store) {
    const meta = Store.meta!;
    const keys = Object.keys(instance) as (keyof typeof instance)[];
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = instance[key];
        const valueCtor =
            typeof value === 'object' && value !== null && value.constructor ? value.constructor : undefined;
        let Class;
        let BoxClass;
        if (value instanceof Meta) {
            instance[key] = value.value;
            Class = value.Class;
            BoxClass = value.BoxClass;
        } else if (
            valueCtor === undefined ||
            valueCtor === Number ||
            valueCtor === String ||
            valueCtor === Boolean ||
            valueCtor === Symbol
        ) {
        } else {
            Class = valueCtor as StoreClass;
        }
        meta.fields.push({
            name: key,
            Class,
            BoxClass,
        });
    }
}

function handlePrototype<Store>(StoreClass: StoreClass<Store>) {
    const meta = StoreClass.meta!;
    const keys = Object.getOwnPropertyNames(StoreClass.prototype) as (keyof typeof StoreClass | 'constructor')[];
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key === 'constructor') continue;
        const descriptor = Object.getOwnPropertyDescriptor(StoreClass.prototype, key)!;
        if (descriptor.get !== undefined) {
            meta.getters.push(descriptor.get);
        } else if (typeof descriptor.value === 'function') {
            meta.methods.push(descriptor.value);
        }
    }
}

function handleStoreClass<Store>(Store: StoreClass<Store>, instance: Store) {
    Store.meta = {
        fields: [],
        getters: [],
        methods: [],
    };
    handleInstance(Store, instance);
    handlePrototype(Store);
}

let ClassIsHandled = true;

function a<A>(a: A) {
    return a;
}

export function root<Class>(target: new () => Class) {
    const Store = a(function(this: {}) {
        ClassIsHandled = typeof Store.meta === 'object';
        target.apply(this, arguments);
        if (!ClassIsHandled) {
            handleStoreClass(Store, this);
            ClassIsHandled = true;
        }
    } as {}) as StoreClass<Class>;
    Store.prototype = target.prototype;
    Store.prototype.constructor = Store;
    Object.setPrototypeOf(Store, target);
    return Store as new () => Class;
}

function meta<Value>(Class: StoreClass, BoxClass: StoreClass | undefined, value: Value): Value {
    if (!ClassIsHandled) {
        return (new Meta(Class, BoxClass, value) as {}) as Value;
    }
    return value;
}

export function array<Store>(Class: StoreClass<Store>): undefined | Store[];
export function array<Store>(Class: StoreClass<Store>, value: Store[]): Store[];
export function array<Store>(Class: StoreClass<Store>, value?: Store[]) {
    return meta(Array, Class, value);
}

export function maybe<Store>(Class: StoreClass<Store>): undefined | Store;
export function maybe<Store>(Class: StoreClass<Store>, value: Store): Store;
export function maybe<Store>(Class: StoreClass<Store>, value?: Store) {
    return meta(Class, undefined, value);
}
