import { toJSON } from './Utils';
import { getClassMetaOrThrow } from './ClassMeta';
import { EntityClass, This } from './Entity';
import { glob } from './Glob';
import { run } from './Atom';
import { hash, HashMap, hashType } from './HashMap';
import { entity, factoryEntity, skip } from './Decorators';
import { attachObject, detachObject, getObjTreeMeta, TreeMeta } from './TreeMeta';

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
    createId() {
        return this.rootStore.createId();
    }
    constructor(public rootStore: RootStore) {
        this._treeMeta.parent = (this as {}) as TreeMeta;
    }
    private _treeMeta = new TreeMeta();
    private instanceMap = new Map<string, Map<string | number, {}>>();
    dispatch(type: string, thisArg: This, payload: {}) {
        detachObject(thisArg);
        this.rootStore.createInstance(thisArg);
        return this.rootStore.dispatch(type, thisArg, payload);
    }
    getInstance<T>(Class: EntityClass<T>, id: number | string = 'default', json: {} | undefined): T {
        const key = Class.name;
        let classMap = this.instanceMap.get(key);
        if (classMap === undefined) {
            classMap = new Map();
            this.instanceMap.set(key, classMap);
        }
        let instance = classMap.get(id);
        if (instance === undefined) {
            instance = factoryEntity(Class, json, undefined);
            (instance as This)._treeMeta._id = id;
            classMap.set(id, instance);
            attachObject(this, instance, undefined);
        }
        return instance as T;
    }
    reset() {
        this.instanceMap.clear();
    }
}
@entity
export class RootStore {
    @skip
    createId() {
        return ++this.lastId;
    }

    @skip lastId = 0;
    @hash(hashType())
    instanceMap = new Map<string, Map<string | number, {}>>();

    @skip _tempComponentStore = new LocalRootStore(this);

    @skip options: RootStoreOptions;

    constructor(options: RootStoreOptions = {}) {
        this.options = options;
        getObjTreeMeta(this)!.parent = (this as {}) as TreeMeta;
    }

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
        const currentState = toJSON(this);
        if (currentState !== state && state !== undefined) {
            this._tempComponentStore.reset();
            factoryEntity(this.constructor as EntityClass, state, this);
            run();
        }
    }

    @skip
    getInstance<T>(Class: EntityClass<T>, id: number | string = 'default'): T {
        getClassMetaOrThrow(Class);
        const key = Class.name;
        const classMap = this.instanceMap.get(key);
        let instance = classMap === undefined ? undefined : (classMap.get(id) as T);
        if (instance !== undefined && instance.constructor !== Object) {
            return instance;
        }
        return this._tempComponentStore.getInstance(Class, id, instance);
    }

    @skip
    createInstance<T>(instance: This) {
        const Class = instance.constructor as EntityClass;
        const key = Class.name;
        let classMap = this.instanceMap.get(key);
        if (classMap === undefined) {
            const elementClassMeta = (Class.prototype as This)._classMeta;
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
    dispatch(type: string, thisArg: This, payload: {}) {
        const action: Action = { type: type, path: thisArg._treeMeta.id, payload };
        for (let i = 0; i < this.subscribers.length; i++) {
            const subscriber = this.subscribers[i];
            subscriber(action, toJSON(this)!);
        }
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
