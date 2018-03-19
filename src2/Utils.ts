import { glob } from './Glob';

export function toJSON(obj: { toJSON?: () => {} | undefined } | undefined): {} | undefined {
    if (obj === null || typeof obj !== 'object') return obj;
    return typeof obj.toJSON === 'function' ? obj.toJSON() : obj;
}

export function checkWeAreInAction() {
    if (!glob.inTransaction) {
        throw new Error('You can change values only in the action methods');
    }
}

export function neverPossible(): never {
    throw new Error('Never possible');
}
