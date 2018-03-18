import { getObjTreeMeta } from './TreeMeta';
import { This } from './Entity';
import { glob } from './Glob';

export type JsonType = undefined | { [key: string]: JsonType };
export type Index<T = {} | undefined> = { [key: string]: T; [key: number]: T };

export function toJSON(obj: { toJSON?: () => {} } | undefined): JsonType {
    if (obj === null || typeof obj !== 'object') return obj;
    return typeof obj.toJSON === 'function' ? obj.toJSON() : obj;
}

export function convertPayloadToPlainObject(payload: {}): {} {
    const treeMeta = getObjTreeMeta(payload);
    if (treeMeta !== undefined) {
        return { _path: treeMeta.id };
    } else if (payload instanceof Object) {
        const keys = Object.keys(payload);
        const newPayload: Index = {};
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const val = (payload as Index)[key];
            newPayload[key] = convertPayloadToPlainObject(val!);
        }
        return newPayload;
    }
    return payload;
}

export function convertPayloadPlainObjectToNormal(payload: Index, instanceMap: Map<string, This>) {
    if (typeof payload === 'object' && payload !== null) {
        if (payload._path) {
            return instanceMap.get((payload._path as {}) as string);
        }
        const keys = Object.keys(payload);
        const newObj: Index = {};
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const val = payload[key];
            newObj[key] = convertPayloadPlainObjectToNormal(val!, instanceMap) as {};
        }
        return newObj;
    }
    return payload;
}

export function checkWeAreInAction() {
    if (!glob.inTransaction) {
        throw new Error('You can change values only in the action methods');
    }
}

export function neverPossible(): never {
    throw new Error('Never possible');
}
