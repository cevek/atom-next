import { AtomCalc } from './Atom';

/** @internal */
export class KeyedAtomCalc<K = {}, T = {} | undefined> {
    protected cache = new Map<K, AtomCalc<T>>();
    constructor(protected thisArg: {}, protected calcFun: (key: string | number) => T) {}
    get(key: K) {
        if (key === undefined) return undefined;
        let atom = this.cache.get(key);
        if (atom === undefined) {
            atom = new AtomCalc<T>(this.thisArg, this.calcFun.bind(this.thisArg, key), 'KeyedAtom.' + key);
            this.cache.set(key, atom);
        }
        return atom.get();
    }

    toJSON() {
        return {};
    }
}
