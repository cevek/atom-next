import { toJSON } from './Utils';
import { applyJsonToEntity, Base, getClassMetaOfEntity, JSONType } from './Entity';
import { glob } from './Glob';
import { run } from './Atom';
import { hash, HashMap, hashType } from './HashMap';
import { attachObject, detachObject, getObjTreeMeta, TreeMeta } from './TreeMeta';
import { skip } from './Decorators';

export type ReduxStore<T> = {
    getState(): T;
    subscribe(callback: () => void): () => void;
    replaceReducer(callback: (action: {}) => {}): void;
    dispatch(action: Action): void;
};

export interface Action {
    type: string;
    path?: string | number;
    payload?: {};
}

interface RootStoreOptions {
    idKey?: string;
}

class LocalRootStore {
    // createId(prefix: string) {
    //     return this.rootStore.createId(prefix);
    // }
    constructor(public rootStore: RootStore) {
        this._treeMeta.parent = (this as {}) as TreeMeta;
    }
    private _treeMeta = new TreeMeta();
    private instanceMap = new Map<string, Map<string | number, {}>>();
    dispatch(type: string, thisArg: Base, payload: {}) {
        detachObject(thisArg);
        this.rootStore.createInstance(thisArg);
        return this.rootStore.dispatch(type, thisArg, payload);
    }
    getInstance(Class: typeof Base, id: number | string = 'default', json: {} | undefined) {
        const key = Class.name;
        let classMap = this.instanceMap.get(key);
        if (classMap === undefined) {
            classMap = new Map();
            this.instanceMap.set(key, classMap);
        }
        let instance = classMap.get(id);
        if (instance === undefined) {
            const prevInTransaction = glob.inTransaction;
            glob.inTransaction = true;
            try {
                instance = Class.create(json, undefined);
            } finally {
                glob.inTransaction = prevInTransaction;
            }
            (instance as Base)._treeMeta._id = id;
            classMap.set(id, instance);
            attachObject(this, instance, undefined);
        }
        return instance;
    }
    get instances() {
        return this.rootStore.instances;
    }
    reset() {
        this.instanceMap.clear();
    }
}
export class RootStore extends Base {
    // createId(prefix: string) {
    //     return prefix + '_' + ++this.lastId;
    // }
    //
    // lastId = 0;

    @hash(hashType())
    private instanceMap = new Map<string, Map<string | number, {}>>();

    @skip private _tempComponentStore = new LocalRootStore(this);

    @skip private options!: RootStoreOptions;

    constructor(options: RootStoreOptions = {}) {
        super();
        // this.options = options;
        getObjTreeMeta(this)!.parent = (this as {}) as TreeMeta;
    }

    static create<T extends typeof Base>(
        this: T,
        json?: JSONType<InstanceType<T>>,
        options: RootStoreOptions = {}
    ): InstanceType<T> {
        const instance = super.create.call(this, json);
        instance.options = options;
        return instance;
    }

    @skip instances = new Instances();

    @skip private subscribers: ((action: Action, state: {}) => void)[] = [];
    @skip
    subscribe(callback: (action: Action, state: {}) => void) {
        callback({ type: 'Init' }, toJSON(this)!);
        this.subscribers.push(callback);
        return () => {
            const pos = this.subscribers.indexOf(callback);
            if (pos > -1) this.subscribers.splice(pos, 1);
        };
    }

    @skip
    setState(state: {}) {
        if (glob.inTransaction) {
            return;
        }
        glob.inTransaction = true;
        try {
            const currentState = toJSON(this);
            if (currentState !== state && state !== undefined) {
                this._tempComponentStore.reset();
                const SelfClass = this.constructor as typeof Base;
                applyJsonToEntity(SelfClass, state, this);
                run();
            }
        } finally {
            glob.inTransaction = false;
            run();
        }
    }

    @skip
    getInstance<T extends typeof Base>(Class: T, id: number | string = 'default'): InstanceType<T> {
        getClassMetaOfEntity(Class);
        const key = Class.name;
        const classMap = this.instanceMap.get(key);
        let instance = classMap === undefined ? undefined : (classMap.get(id) as InstanceType<T>);
        if (instance !== undefined && instance.constructor !== Object) {
            return instance;
        }
        return this._tempComponentStore.getInstance(Class, id, instance) as InstanceType<T>;
    }

    @skip
    createInstance<T>(instance: Base) {
        const Class = instance.constructor as typeof Base;
        const key = Class.name;
        let classMap = this.instanceMap.get(key);
        if (classMap === undefined) {
            const elementClassMeta = (Class.prototype as Base)._classMeta;
            classMap = HashMap.factory(elementClassMeta, {}, undefined);
            this.instanceMap.set(key, classMap);
        }
        classMap.set(instance._treeMeta._id!, instance);
    }

    // @skip
    // reducer = (state: {}, action: Action) => {
    //     return toJSON(this);
    //     // if (glob.inTransaction) {
    //     //     return currentState;
    //     // } else {
    //     //     if (action.type === '@@INIT') return currentState;
    //     //     if (currentState !== state) return neverPossible();
    //     //     const newState = patch(currentState, action.payload);
    //     //     applyNewState(this, newState);
    //     //     return newState;
    //     // }
    // };

    @skip
    dispatch(type: string, thisArg: Base, payload: {}) {
        const action: Action = { type: type, path: thisArg._treeMeta.id, payload };
        for (let i = 0; i < this.subscribers.length; i++) {
            const subscriber = this.subscribers[i];
            subscriber(action, toJSON(this)!);
        }
    }
}

class Instances {
    private instMap = new Map();

    add(instance: Base) {
        const key = instance.constructor.name;
        let classMap = this.instMap.get(key);
        if (classMap === undefined) {
            classMap = new Map();
            this.instMap.set(key, classMap);
        }
        classMap.set(instance._treeMeta.id, instance);
    }
    delete(instance: Base) {
        const key = instance.constructor.name;
        const classMap = this.instMap.get(key);
        if (classMap === undefined) {
            throw new Error("Instance map doesn't exist");
        }
        classMap.delete(instance._treeMeta.id, instance);
    }
    get(Class: typeof Base, id: string | number) {
        const classMap = this.instMap.get(Class.name);
        if (classMap === undefined) {
            return undefined;
        }
        return classMap.get(id);
    }
}

// function registerClass(rootStore: RootStore, classMeta: ClassMeta) {
// const { reducers, fields } = classMeta;
// for (let i = 0; i < reducers.length; i++) {
//     const { name, reducer } = reducers[i];
//     rootStore._reducersMap.set(name, reducer);
// }
// for (let i = 0; i < fields.length; i++) {
//     const field = fields[i];
//     for (let j = 0; j < field.subClassMeta.length; j++) {
//         const subClassMeta = field.subClassMeta[j];
//         registerClass(rootStore, subClassMeta);
//     }
// }
// }
