import { glob } from './Glob';

/** @internal */
export function toJSON(obj: {}): {} | undefined {
    if (obj === null || typeof obj !== 'object') return obj;
    return typeof obj['toJSON'] === 'function' ? obj['toJSON']() : obj;
}
/** @internal */
export function checkWeAreInAction() {
    if (!glob.inTransaction) {
        throw new Error('You can change values only in the action methods');
    }
}
/** @internal */
export function neverPossible(): never {
    throw new Error('Never possible');
}
