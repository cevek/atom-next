import { getObjTreeMeta, TreeMeta } from './TreeMeta';
import { ArrayProxy, setArrayData, toJSONArray } from './Array';
import { Field } from './Field';

export function toJSON(obj: any) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof ArrayProxy) {
        return toJSONArray(obj);
    }
    const { _fields, _treeMeta } = obj as This;
    if (_treeMeta.json !== undefined) return _treeMeta.json;
    const json: any = {};
    for (let i = 0; i < _fields.length; i++) {
        const field = _fields[i];
        const val = obj[field.name];
        json[field.name] = toJSON(val);
    }
    _treeMeta.json = json;
    return json;
}

export function setData(obj: {}, json: any) {
    if (obj instanceof ArrayProxy) {
        return setArrayData(obj, json);
    }
    if (obj instanceof Object) {
        const { _fields, _treeMeta } = obj as This;
        for (let i = 0; i < _fields.length; i++) {
            const field = _fields[i];
            const val = json[field.name];
            let currentVal = (obj as any)[field.name];
            if (currentVal !== null && typeof currentVal === 'object') {
                if (!(currentVal instanceof Object) && field.Class !== undefined) {
                    currentVal = factory(field.Class, field.elementFactory);
                }
                setData(currentVal, val);
            } else {
                (obj as any)[field.name] = val;
            }
        }
        _treeMeta.json = json;
    }
    return obj;
}

export interface Reducer {
    name: string;
    reducer: Function;
}

export interface This<T = {}> {
    _treeMeta: TreeMeta<T>;
    _fields: Field[];
    _reducers: Reducer[];
}

export function factory(Class: new (elementFactory?: new () => {}) => {}, elementFactory: undefined | (new () => {})): This {
    const instance = new Class(elementFactory);
    return instance as This;
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
