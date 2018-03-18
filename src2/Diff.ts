type Any = any;
const enum Code {
    SET_ARRAY = 'array',
    PATCH_ARRAY = 'patchArray',
    UNDEFINED = 'undefined',
    DATE = 'date',
    DELETE = 'del',
}
const enum ArrayCode {
    ARRAY_UPDATE_ITEM = 'patch',
    ARRAY_NEW_ITEM = 'new',
}
function isObject(a: Any) {
    return a !== null && typeof a === 'object';
}

function handleType(a: Any): Any {
    if (a === undefined) {
        return [Code.UNDEFINED];
    }
    if (a instanceof Array) {
        return [Code.SET_ARRAY, a.map(handleType)];
    }
    if (a instanceof Date) {
        return [Code.DATE, a.toJSON()];
    }
    return a;
}

function diffA(a: Any[], b: Any[], idKey: string): Any[] {
    const res: Any[] = [Code.PATCH_ARRAY];
    let start = 0;
    let end = b.length;
    const lenDiff = b.length - a.length;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    while (end > lenDiff + start && end > start && a[end - 1 - lenDiff] === b[end - 1]) end--;

    if (start > 0) res.push(-start);
    if (end - start > 0) {
        const aCopy = a.slice();
        for (let i = start; i < end; i++) {
            const item = b[i];
            let pos = -1;
            // check by link
            for (let j = start; j < end - lenDiff; j++) {
                if (a[j] === item) {
                    pos = j;
                    break;
                }
            }
            // check by object ids
            if (pos === -1 && item[idKey] !== undefined) {
                const itemId = item[idKey];
                for (let j = start; j < end - lenDiff; j++) {
                    const val = aCopy[j];
                    if (val !== null && typeof val === 'object' && val[idKey] === itemId) {
                        pos = j;
                        break;
                    }
                }
            }
            if (pos === -1) {
                res.push([ArrayCode.ARRAY_NEW_ITEM, handleType(item)]);
            } else {
                aCopy[pos] = null!;
                if (a[pos] === b[i]) {
                    res.push(pos);
                } else {
                    const diffRes = diff(a[pos], b[i], idKey);
                    res.push([ArrayCode.ARRAY_UPDATE_ITEM, pos, diffRes]);
                }
            }
        }
    }
    if (end < b.length) res.push(-(b.length - end));
    return res;
}

export function diff(a: Any, b: Any, idKey = 'id') {
    if (a === b) {
        return {};
    }
    if (isObject(a) && isObject(b) && a.constructor === b.constructor) {
        // objects
        if (a.constructor === Object) {
            const ret: Any = {};
            const aKeys = Object.keys(a);
            for (let i = 0; i < aKeys.length; i++) {
                const aKey = aKeys[i];
                if (!b.hasOwnProperty(aKey)) {
                    ret[aKey] = [Code.DELETE];
                }
            }
            const bKeys = Object.keys(b);
            for (let i = 0; i < bKeys.length; i++) {
                const key = bKeys[i];
                if (a[key] !== b[key]) {
                    ret[key] = diff(a[key], b[key], idKey);
                }
            }
            return ret;
        }
        if (a instanceof Array) {
            return diffA(a, b, idKey);
        }
        return handleType(b);
    }
    return handleType(b);
}

function patchArray(oldArr: Any[], p: Any[]) {
    const newArr = [];
    let left = 0;
    if (p[1] < 0) {
        left = -p[1];
        for (let i = 0; i < left; i++) {
            newArr.push(patch(oldArr[i], oldArr[i]));
        }
    }
    for (let i = 1; i < p.length; i++) {
        const item = p[i];
        if (item >= 0) {
            newArr.push(patch(oldArr[item], oldArr[item]));
        } else if (item < 0) {
        } else if (Array.isArray(item)) {
            if (item[0] === ArrayCode.ARRAY_NEW_ITEM) {
                newArr.push(patch(undefined!, item[1]));
            } else if (item[0] === ArrayCode.ARRAY_UPDATE_ITEM) {
                newArr.push(patch(oldArr[item[1]], item[2]));
            } else {
                never(item as never);
            }
        } else {
            never(item as never);
        }
    }
    if ((left === 0 || p.length > 2) && p[p.length - 1] < 0) {
        const right = -p[p.length - 1];
        for (let i = oldArr.length - right; i < oldArr.length; i++) {
            newArr.push(oldArr[i]);
        }
    }
    return newArr;
}

function never(a: never): never {
    throw new Error('Never type: ' + JSON.stringify(a));
}

const DeletedKey = Symbol('deleted');

export function patch(old: Any, p: Any): Any {
    if (p instanceof Array) {
        const type = p[0] as Code;
        switch (type) {
            case Code.DATE:
                return new Date(p[1]);
            case Code.UNDEFINED:
                return undefined;
            case Code.SET_ARRAY:
                return p[1].map((item: {}) => patch(old, item));
            case Code.PATCH_ARRAY:
                return patchArray(old, p);
            case Code.DELETE:
                return DeletedKey;
            default:
                return never(type);
        }
    }
    if (old instanceof Object && p instanceof Object) {
        const newObj: Any = {};
        const keys = Object.keys(p);
        const appliedKeys: Any = {};
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const patchValue = p[key];
            const objValue = old[key];
            const value = patch(objValue, patchValue);
            appliedKeys[key] = true;
            if (value !== DeletedKey) {
                newObj[key] = value;
            }
        }
        const oldKeys = Object.keys(old);
        for (let i = 0; i < oldKeys.length; i++) {
            const key = oldKeys[i];
            if (appliedKeys[key] === undefined) {
                newObj[key] = old[key];
            }
        }

        return newObj;
    }
    return p;
}
