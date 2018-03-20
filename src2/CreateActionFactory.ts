import { glob } from './Glob';
import { getRootStore } from './TreeMeta';
import { toJSON } from './Utils';
import { diff } from './Diff';
import { This } from './Entity';
import { run } from './Atom';

export function createActionFactory<Fun extends Function>(type: string, reducer: Fun): Fun {
    return (function(this: This, payload: {}) {
        if (glob.inTransaction) {
            reducer.call(this, payload);
        } else {
            const prevInTransaction = glob.inTransaction;
            glob.inTransaction = true;
            try {
                const rootStore = getRootStore(this._treeMeta);
                if (rootStore !== undefined) {
                    const oldState = toJSON(rootStore);
                    reducer.call(this, payload);
                    rootStore.dispatch(type, this, diff(oldState, toJSON(rootStore)!));
                } else {
                    throw new Error('This object is not in the store tree');
                }
            } finally {
                glob.inTransaction = prevInTransaction;
                run();
            }
        }
    } as {}) as Fun;
}
