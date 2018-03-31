import { glob } from './Glob';
import { getRootStoreOrThrow } from './TreeMeta';
import { Base } from './Entity';
import { run } from './Atom';

/** @internal */
export function createActionFactory<Fun extends Function>(type: string, reducer: Fun): Fun {
    return (function(this: Base, ...args: any[]) {
        if (glob.inTransaction) {
            return reducer.call(this, ...args);
        } else {
            const prevInTransaction = glob.inTransaction;
            glob.inTransaction = true;
            try {
                const rootStore = getRootStoreOrThrow(this._treeMeta);
                const beforeJson = rootStore.toJSON();
                const res = reducer.call(this, ...args);
                const afterJson = rootStore.toJSON();
                if (beforeJson !== afterJson) {
                    rootStore.dispatch(type, this, {});
                } else {
                    console.error('Action ' + type + " doesn't change anything");
                }
                return res;
            } finally {
                glob.inTransaction = prevInTransaction;
                run();
            }
        }
    } as {}) as Fun;
}
