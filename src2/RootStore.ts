import { toJSON } from './Utils';
import { ClassMeta, getClassMetaOrThrow, transformValue } from './ClassMeta';
import { EntityClass, This } from './Entity';
import { glob } from './Glob';
import { run } from './Atom';
import { hash, HashMap, hashType } from './HashMap';
import { entity, factoryEntity, skip } from './Decorators';
import { TreeMeta } from './TreeMeta';
import { createField } from './Field';

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

@entity
class Dummy {}

interface RootStoreOptions {
    reduxStore?: ReduxStore<{}>;
    idKey?: string;
}
@entity
export class RootStore {
    createId() {
        return ++this.lastId;
    }

    @skip lastId = 0;
    @hash(hashType())
    instanceMap = new Map<string, Map<string | number, {}>>();

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
        const classMeta = getClassMetaOrThrow(EntClass);
        registerClass(this, classMeta);
        const key = Class.name;
        let classMap = this.instanceMap.get(key);
        if (classMap === undefined) {
            classMap = HashMap.factory(
                new ClassMeta((json, prev) => factoryEntity(EntClass, json, prev)),
                {},
                undefined
            );
        }
        let instance = classMap.get(id);
        if (instance === undefined) {
            instance = this.createInstance(EntClass, key, classMap, id, instance);
        } else if (instance instanceof Object && instance.constructor === Object) {
            instance = transformValue(
                createField(id, new ClassMeta((json, prev) => factoryEntity(EntClass, json, prev))),
                instance,
                undefined
            );
            const prevInTransaction = glob.inTransaction;
            glob.inTransaction = true;
            classMap.set(id, instance);
            glob.inTransaction = prevInTransaction;
        }
        return instance as T;
    }

    createInstance<T>(
        Class: EntityClass,
        key: string,
        classMap: Map<string | number, {}>,
        id: string | number,
        json: {} | undefined
    ) {
        this.instanceMap.set(key, classMap);
        const instance = transformValue(
            createField(id, new ClassMeta((json, prev) => factoryEntity(Class, json, prev))),
            json === undefined ? new Class() : json,
            undefined
        );
        classMap.set(id, instance);
        return instance;
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
