import { glob } from './Glob';
import { getRootStore } from './TreeMeta';
import { toJSON } from './Utils';
import { diff } from './Diff';
import { This } from './Entity';
import { run } from './Atom';

export function createActionFactory<Fun extends Function>(type: string, reducer: Fun): Fun {
    return (function(this: This, ...args: any[]) {
        if (glob.inTransaction) {
            return reducer.call(this, ...args);
        } else {
            const prevInTransaction = glob.inTransaction;
            glob.inTransaction = true;
            try {
                const rootStore = getRootStore(this._treeMeta);
                if (rootStore !== undefined) {
                    const res = reducer.call(this, ...args);
                    rootStore.dispatch(type, this, {});
                    return res;
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
