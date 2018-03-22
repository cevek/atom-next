import { toJSON } from './Utils';
import { ClassMeta, getClassMetaOrThrow } from './ClassMeta';
import { EntityClass, This } from './Entity';
import { glob } from './Glob';
import { run } from './Atom';
import { hash, HashMap, hashType } from './HashMap';
import { entity, factoryEntity, skip } from './Decorators';
import { attachObject, detachObject, TreeMeta } from './TreeMeta';

export type ReduxStore<T> = {
    getState(): T;
    subscribe(callback: () => void): () => void;
    replaceReducer(callback: (action: {}) => {}): void;
    dispatch(action: Action): void;
};
export interface CustomStore extends ReduxStore<{}> {
    atomStore: RootStore;
}

export interface Action {
    type: string;
    path?: string | number;
    payload?: {};
}

interface RootStoreOptions {
    reduxStore?: ReduxStore<{}>;
    idKey?: string;
}

class LocalRootStore {
    createId() {
        return this.rootStore.createId();
    }
    constructor(public rootStore: RootStore) {
        this._treeMeta.parent = (this as {}) as TreeMeta;
    }
    _treeMeta = new TreeMeta();
    instanceMap = new Map<string, Map<string | number, {}>>();
    dispatch(type: string, thisArg: This, payload: {}) {
        detachObject(thisArg);
        this.rootStore.createInstance(thisArg);
        return this.rootStore.dispatch(type, thisArg, payload);
    }
    getInstance<T>(Class: new () => T, id: number | string = 'default'): T {
        const key = Class.name;
        let classMap = this.instanceMap.get(key);
        if (classMap === undefined) {
            classMap = new Map();
            this.instanceMap.set(key, classMap);
        }
        let instance = classMap.get(id);
        if (instance === undefined) {
            instance = new Class();
            (instance as This)._treeMeta._id = id;
            classMap.set(id, instance);
            attachObject(this, instance, undefined);
        }
        return instance as T;
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

    @skip _reduxStore: CustomStore = undefined!;
    @skip options: RootStoreOptions;

    constructor(options: RootStoreOptions = {}) {
        this.options = options;
        ((this as {}) as This)._treeMeta.parent = (this as {}) as TreeMeta;
        if (options.reduxStore !== undefined) {
            this.setReduxStore(options.reduxStore);
        }
    }

    @skip
    private setReduxStore(store: ReduxStore<{}>) {
        store.replaceReducer(() => toJSON(this)!);
        this._reduxStore = store as CustomStore;
        this._reduxStore.atomStore = this;
        store.subscribe(() => {
            const state = store.getState();
            if (glob.inTransaction) {
                return;
            }
            if (state !== undefined) {
                factoryEntity(this.constructor as EntityClass, state, this);
                run();
            }
        });
    }

    @skip
    getInstance<T>(Class: new () => T, id: number | string = 'default'): T {
        const EntClass = (Class as {}) as EntityClass;
        getClassMetaOrThrow(EntClass);
        const key = Class.name;
        const classMap = this.instanceMap.get(key);
        let instance = classMap === undefined ? undefined : (classMap.get(id) as T);
        if (instance !== undefined) {
            return instance;
        }
        return this._tempComponentStore.getInstance(Class, id);
    }

    @skip
    createInstance<T>(instance: This) {
        const Class = instance.constructor as EntityClass;
        const key = Class.name;
        let classMap = this.instanceMap.get(key);
        if (classMap === undefined) {
            const elementClassMeta = Class.prototype._classMeta;
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
        this._reduxStore.dispatch(action);
    }
}

function registerClass(rootStore: RootStore, classMeta: ClassMeta) {
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
}
