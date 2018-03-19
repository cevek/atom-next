import { getObjTreeMeta } from './TreeMeta';
import { This } from './Entity';
import { glob } from './Glob';

export function toJSON(obj: { toJSON?: () => {} | undefined } | undefined): {} | undefined {
    if (obj === null || typeof obj !== 'object') return obj;
    return typeof obj.toJSON === 'function' ? obj.toJSON() : obj;
}

export function convertPayloadToPlainObject(payload: {}): {} {
    const treeMeta = getObjTreeMeta(payload);
    if (treeMeta !== undefined) {
        // const ret: WithPath = { _path: treeMeta.id! };
        // return ret;
    } else if (payload instanceof Object) {
        const keys = Object.keys(payload);
        const newPayload = {};
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const val = payload[key];
            newPayload[key] = convertPayloadToPlainObject(val);
        }
        return newPayload;
    }
    return payload;
}

export function convertPayloadPlainObjectToNormal(payload: {}, instanceMap: Map<string, This>) {
    if (typeof payload === 'object' && payload !== null) {
        // const path = payload as WithPath;
        // if (path._path) {
        //     return instanceMap.get(path._path);
        // }
        const keys = Object.keys(payload);
        const newObj = {};
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

export function neverPossible(): never {
    throw new Error('Never possible');
}
