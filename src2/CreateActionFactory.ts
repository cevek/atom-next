import { glob } from './Glob';
import { getRootStore } from './TreeMeta';
import { toJSON } from './utils';
import { diff } from './diff';
import { This } from './Entity';
import { run } from '../src/atom';

export function createActionFactory(type: string, reducer: Function) {
    return function(this: This, payload: {}) {
        if (glob.inTransaction) {
            reducer.call(this, payload);
        } else {
            glob.inTransaction = true;
            try {
                const rootStore = getRootStore(this._treeMeta);
                if (rootStore !== void 0) {
                    const oldState = rootStore._treeMeta.json;
                    reducer.call(this, payload);
                    rootStore.dispatch(type, this, diff(oldState, toJSON(rootStore)));
                } else {
                    throw new Error('This object is not in the store tree');
                }
            } finally {
                glob.inTransaction = false;
                run();
            }
        }
    };
}