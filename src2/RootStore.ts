import { Field } from './Field';
import { convertPayloadToPlainObject, factory, Reducer, setData, This, toJSON } from './utils';
import { TreeMeta } from './TreeMeta';

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
    _reducers!: Reducer[];
    _fields: Field[] = [{ name: 'lastId', elementFactory: undefined, Class: undefined, idx: 0 }];
    lastId = 1;

    _reducersMap = new Map<string, (payload: {}) => void>();
    _reduxStore!: CustomStore;
    _instanceMap = new Map<string, This>();
    // _factoryMap = new Map<string, number>();
    _path = 'root';

    constructor(private stores: (new () => {})[]) {
        this._treeMeta.parent = this as any;
        stores.forEach((Store, i) => {
            // this._factoryMap.set(Store.name, i);
            this._instanceMap.set(Store.name, factory(Store, undefined));
            this._registerReducersFromClass(Store);
            this._fields.push({ name: Store.name, idx: i, Class: Store, elementFactory: undefined });
        });
    }

    setReduxStore(store: Store<{}>) {
        this._reduxStore = store as CustomStore;
        this._reduxStore.atomStore = this;
        store.subscribe(() => {
            const state = store.getState();
            if (state !== toJSON(this)) {
                setData(this, state);
            }
        });
    }

    mainReducer = (state: {}, action: Action): {} => {
        // return patch(state, action.payload);
        return state;
    };

    dispatch(type: string, thisArg: This, payload: {}) {
        payload = convertPayloadToPlainObject(payload);
        const action: Action = { type: type, path: thisArg._treeMeta.id, payload };
        this._reduxStore.dispatch(action);
    }

    _registerReducersFromClass(Class: new () => {}) {
        const reducers = Class.prototype._reducersMap;
        for (let i = 0; i < reducers.length; i++) {
            const { name, reducer } = reducers[i];
            this._reducersMap.set(name, reducer);
        }
    }
}
