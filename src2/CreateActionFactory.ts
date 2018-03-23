import { glob } from './Glob';
import { getRootStoreOrThrow } from './TreeMeta';
import { Base } from './Entity';
import { run } from './Atom';

export function createActionFactory<Fun extends Function>(type: string, reducer: Fun): Fun {
    return (function(this: Base, ...args: any[]) {
        if (glob.inTransaction) {
            return reducer.call(this, ...args);
        } else {
            const prevInTransaction = glob.inTransaction;
            glob.inTransaction = true;
            try {
                const rootStore = getRootStoreOrThrow(this._treeMeta);
                const res = reducer.call(this, ...args);
                rootStore.dispatch(type, this, {});
                return res;
            } finally {
                glob.inTransaction = prevInTransaction;
                run();
            }
        }
    } as {}) as Fun;
}
