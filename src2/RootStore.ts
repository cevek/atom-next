import { convertPayloadToPlainObject, neverPossible, toJSON } from './Utils';
import { attachObject, TreeMeta } from './TreeMeta';
import { ClassMeta, getClassMetaOrThrow, transformValue } from './ClassMeta';
import { EntityClass, EntityClassPublic, This } from './Entity';
import { createField } from './Field';
import { glob } from './Glob';
import { run } from './Atom';

export type Store<T> = {
    getState(): T;
    subscribe(callback: () => void): () => void;
    dispatch(action: Action): void;
};
export interface CustomStore extends Store<{}> {
    atomStore: RootStore;
}

export interface Action {
    type: string;
    path?: string | number;
    payload?: {};
}

export class RootStore implements This {
    _treeMeta = new TreeMeta();
    _classMeta!: ClassMeta;
    lastId = 1;
    _reducersMap = new Map<string, Function>();
    _reduxStore!: CustomStore;
    // roots: { [key: string]: { default: This | undefined; ids: { [key: string]: This } } } = {};
    // _factoryMap = new Map<string, number>();

    constructor(private stores: (EntityClassPublic)[], private options: { idKey?: string } = {}) {
        this._treeMeta.parent = this as any;
        this._classMeta.fields = [createField('lastId', undefined)];
        if (stores !== undefined) {
            stores.forEach(Store => this.getInstance(Store));
        }
    }

    setReduxStore(store: Store<{}>) {
        this._reduxStore = store as CustomStore;
        this._reduxStore.atomStore = this;
        store.subscribe(() => {
            const state = store.getState();
            if (glob.inTransaction) {
                return;
            }
            if (state !== undefined) {
                applyNewState(this, state);
            }
        });
    }

    getInstance<T>(Class: new () => T): T {
        const Cls = (Class as {}) as EntityClass;
        const classMeta = getClassMetaOrThrow(Cls);
        registerClass(this, classMeta);
        const key = Cls.name;
        let instance = ((this as {}) as { [key: string]: This })[key];
        if (instance === undefined) {
            const field = createField(key, classMeta);
            field.subClassMeta.push(classMeta);
            const instance = new Cls();
            ((this as {}) as { [key: string]: This })[key] = instance;
            attachObject(this, instance);
            this._classMeta.fields.push(field);
        }
        return (instance as {}) as T;
    }

    reducer = (state: {}, action: Action): {} => {
        return toJSON(this);
        // if (glob.inTransaction) {
        //     return currentState;
        // } else {
        //     if (action.type === '@@INIT') return currentState;
        //     if (currentState !== state) return neverPossible();
        //     const newState = patch(currentState, action.payload);
        //     applyNewState(this, newState);
        //     return newState;
        // }
    };

    dispatch(type: string, thisArg: This, payload: {}) {
        payload = convertPayloadToPlainObject(payload);
        const action: Action = { type: type, path: thisArg._treeMeta.id, payload };
        this._reduxStore.dispatch(action);
    }

    toJSON() {
        if (this._treeMeta.json !== undefined) return this._treeMeta.json;
        const json: any = {};
        const fields = this._classMeta.fields;
        for (let i = 0; i < fields.length; i++) {
            const key = fields[i].name;
            json[key] = toJSON((this as any)[key]);
        }
        this._treeMeta.json = json;
        return json;
    }
}

RootStore.prototype._classMeta = new ClassMeta(neverPossible);

function applyNewState(rootStore: RootStore, json: any) {
    const fields = rootStore._classMeta.fields;
    const prevInTransaction = glob.inTransaction;
    try {
        glob.inTransaction = true;
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            (rootStore as any)[field.name] = transformValue(field, json[field.name], (rootStore as any)[field.name]);
        }
    } finally {
        glob.inTransaction = prevInTransaction;
        run();
    }
}

function registerClass(rootStore: RootStore, classMeta: ClassMeta) {
    const { reducers, fields } = classMeta;
    for (let i = 0; i < reducers.length; i++) {
        const { name, reducer } = reducers[i];
        rootStore._reducersMap.set(name, reducer);
    }
    for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        for (let j = 0; j < field.subClassMeta.length; j++) {
            const subClassMeta = field.subClassMeta[j];
            registerClass(rootStore, subClassMeta);
        }
    }
}
