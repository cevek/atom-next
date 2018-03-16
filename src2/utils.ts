import { getObjTreeMeta } from './TreeMeta';
import { ArrayProxy, setArrayData, toJSONArray } from './Array';
import { EntityClass, This } from './Entity';
import { getClassMetaOrThrow } from './ClassMeta';
import { glob } from './Glob';

export function toJSON(obj: This) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof ArrayProxy) {
        return toJSONArray(obj);
    }
    const classMeta = getClassMetaOrThrow(obj.constructor as EntityClass);
    const treeMeta = getObjTreeMeta(obj);
    if (treeMeta === undefined) return {};
    if (treeMeta.json !== undefined) return treeMeta.json;
    const json: any = {};
    for (let i = 0; i < classMeta.fields.length; i++) {
        const field = classMeta.fields[i];
        const val = (obj as any)[field.name];
        json[field.name] = toJSON(val);
    }
    treeMeta.json = json;
    return json;
}

export function setData(obj: {}, json: any) {
    try {
        glob.inTransaction = true;
        if (obj instanceof ArrayProxy) {
            return setArrayData(obj, json);
        }
        if (obj instanceof Object) {
            const { _classMeta: { fields }, _treeMeta } = obj as This;
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                const val = json[field.name];
                let currentVal = (obj as any)[field.name];
                if (currentVal instanceof Object) {
                    setData(currentVal, val);
                } else {
                    (obj as any)[field.name] = val;
                }
            }
            _treeMeta.json = json;
        }
        return obj;
    } finally {
        glob.inTransaction = false;
    }
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
