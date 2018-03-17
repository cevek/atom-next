import { getObjTreeMeta } from './TreeMeta';
import { This } from './Entity';
import { glob } from './Glob';


export function toJSON(obj: any) {
    if (obj === null || typeof obj !== 'object') return obj;
    return typeof obj.toJSON === 'function' ? obj.toJSON() : obj;
}

export function convertPayloadToPlainObject(payload: {}) {
    const treeMeta = getObjTreeMeta(payload);
    if (treeMeta !== undefined) {
        return { _path: treeMeta.id };
    } else if (payload instanceof Object) {
        const keys = Object.keys(payload);
        const newPayload: any = {};
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const val = (payload as any)[key];
            newPayload[key] = convertPayloadToPlainObject(val);
        }
        return newPayload;
    }
    return payload;
}

export function convertPayloadPlainObjectToNormal(payload: any, instanceMap: Map<string, This>) {
    if (typeof payload === 'object' && payload !== null) {
        if (payload._path) {
            return instanceMap.get(payload._path);
        }
        const keys = Object.keys(payload);
        const newObj: any = {};
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const val = payload[key];
            newObj[key] = convertPayloadPlainObjectToNormal(val, instanceMap);
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

export function neverPossible() {
    throw new Error('Never possible');
}
