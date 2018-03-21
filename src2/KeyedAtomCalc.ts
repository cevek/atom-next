import { AtomCalc } from './Atom';
import { toJSON } from './Utils';

export class KeyedAtomCalc<T = {} | undefined> {
    protected cache: { [key: string]: AtomCalc<T>; [key: number]: AtomCalc<T> } = {};
    constructor(protected thisArg: {}, protected calcFun: (key: string | number) => T) {}
    get(key: string | number | undefined) {
        if (key === undefined) return undefined;
        let atom = this.cache[key];
        if (atom === undefined) {
            this.cache[key] = atom = new AtomCalc<T>(
                this.thisArg,
                this.calcFun.bind(this.thisArg, key),
                'KeyedAtom.' + key
            );
        }
        return atom.get();
    }

    toJSON() {
        const json = {};
        const keys = Object.keys(this.cache);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            json[key] = toJSON(this.cache[key]);
        }
        return json;
    }
}
