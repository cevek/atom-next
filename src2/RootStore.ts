import { toJSON } from './Utils';
import { Base } from './Entity';
import './Array';
import './HashMap';
import { glob } from './Glob';
import { run } from './Atom';
import { HashMap } from './HashMap';
import { attachObject, detachObject, getObjTreeMeta, TreeMeta } from './TreeMeta';
import { hash, hashType, skip } from './Decorators';
import { getClassMetaOfEntity, JSONType } from './EntityUtils';

/** @internal */
export type ReduxStore<T> = {
    getState(): T;
    subscribe(callback: () => void): () => void;
    replaceReducer(callback: (action: {}) => {}): void;
    dispatch(action: Action): void;
};

/** @internal */
export interface Action {
    type: string;
    path?: string | number;
    payload?: {};
}

export interface RootStoreOptions {
    // idKey?: string;
    remotedev?: {
        extractState(msg: {}): {};
        connectViaExtension(): {
            subscribe(cb: (msg: {}) => void): void;
            send(action: {}, state: {}): void;
        };
    };
}

class LocalRootStore {
    // createId(prefix: string) {
    //     return this.rootStore.createId(prefix);
    // }
    constructor(public rootStore: RootStore) {
        this._treeMeta.parent = (this as {}) as TreeMeta;
    }
    private _treeMeta = new TreeMeta();
    private tempInstances = new Set<Base>();
    dispatch(type: string, thisArg: Base, payload: {}) {
        // if we change our component state
        detachObject(thisArg);
        // apply it to our normal store within transaction
        this.rootStore.saveInstance(thisArg);
        return this.rootStore.dispatch(type, thisArg, payload);
    }
    getInstance(Class: typeof Base, id: number | string = 'default', json: {} | undefined) {
        let instance = this.instances.get(Class, id);
        if (instance !== undefined) {
            if (!this.tempInstances.has(instance)) {
                instance = undefined;
            }
        }
        if (instance === undefined) {
            const prevInTransaction = glob.inTransaction;
            glob.inTransaction = true;
            try {
                instance = Class.create(json, undefined);
                instance.id = id;
            } finally {
                glob.inTransaction = prevInTransaction;
            }
            this.instances.add(instance);
            this.tempInstances.add(instance);
            attachObject(this, instance, undefined);
        }
        return instance;
    }
    get instances() {
        return this.rootStore.instances;
    }
    reset() {
        this.tempInstances.clear();
    }
    toJSON() {
        return {};
    }
}

export class RootStore extends Base {
    /** @internal */
    @hash(hashType())
    private instanceMap = new Map<string, Map<string | number, {}>>();
    /** @internal */
    @skip private _tempComponentStore = new LocalRootStore(this);
    /** @internal */
    @skip private options: RootStoreOptions = {};

    constructor() {
        super();
        getObjTreeMeta(this)!.parent = (this as {}) as TreeMeta;
    }

    private applyRemoteDev() {
        const remoteDev = this.options.remotedev;
        if (remoteDev !== undefined) {
            const conn = remoteDev.connectViaExtension();
            conn.subscribe(message => this.setState(remoteDev.extractState(message) as JSONType<this>));
            this.subscribe((action, state) => conn.send(action, state));
        }
    }

    static init(options: RootStoreOptions = {}) {
        const instance = this.create() as RootStore;
        instance.options = options;
        if (options.remotedev !== undefined) {
            instance.applyRemoteDev();
        }
        return instance;
    }

    /** @internal */
    @skip instances = new Instances();
    /** @internal */
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
    setState(state: JSONType<this>) {
        if (glob.inTransaction) {
            return;
        }
        glob.inTransaction = true;
        try {
            const currentState = toJSON(this);
            if (currentState !== state && state !== undefined) {
                this._tempComponentStore.reset();
                this.__fromJSON(state);
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

    /** @internal */
    @skip
    saveInstance<T>(instance: Base) {
        const Class = instance.constructor as typeof Base;
        const key = Class.name;
        let classMap = this.instanceMap.get(key);
        if (classMap === undefined) {
            const elementClassMeta = (Class.prototype as Base)._classMeta;
            classMap = HashMap.factory(elementClassMeta, {}, undefined);
            this.instanceMap.set(key, classMap);
        }
        classMap.set(instance.id, instance);
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
    /** @internal */
    @skip
    dispatch(type: string, thisArg: Base, payload: {}) {
        const action: Action = { type: type, path: thisArg.id, payload };
        for (let i = 0; i < this.subscribers.length; i++) {
            const subscriber = this.subscribers[i];
            subscriber(action, toJSON(this)!);
        }
    }
}
/** @internal */
export class Instances {
    private instMap = new Map<string, Map<string | number, Base>>();

    add(instance: Base) {
        const key = instance.constructor.name;
        let classMap = this.instMap.get(key);
        if (classMap === undefined) {
            classMap = new Map();
            if (this.instMap.has(key)) {
                throw new Error('Instance already exists');
            }
            this.instMap.set(key, classMap);
        }
        classMap.set(instance.id, instance);
    }
    delete(instance: Base) {
        const key = instance.constructor.name;
        const classMap = this.instMap.get(key);
        if (classMap === undefined) {
            throw new Error("Instance map doesn't exist");
        }
        classMap.delete(instance.id);
    }
    get(Class: typeof Base, id: string | number): Base | undefined {
        const classMap = this.instMap.get(Class.name);
        if (classMap === undefined) {
            return undefined;
        }
        return classMap.get(id);
    }

    getOrThrow(Class: typeof Base, id: string | number): Base | undefined {
        const res = this.get(Class, id);
        if (res === undefined) {
            throw new Error('Instance has not in the tree');
        }
        return res;
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
