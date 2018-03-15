interface Item {
    id: number;
}

const enum Code {
    SET_ARRAY = 'a',
    PATCH_ARRAY = 'pa',
    UNDEFINED = 'undefined',
    DATE = 'd',
    DELETE = 'del',
}

function isObject(a: any) {
    return a !== null && typeof a === 'object';
}

function handleType(a: any): any {
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

function diffA(a: Item[], b: Item[]): any[] {
    const res: any[] = [Code.PATCH_ARRAY];
    let start = 0;
    let end = b.length;
    const lenDiff = b.length - a.length;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    while (end > lenDiff && end > 0 && a[end - 1 - lenDiff] === b[end - 1]) end--;

    if (start > 0) res.push(-start);
    if (end - start > 0) {
        const map: any = {};
        for (let i = start; i < end - lenDiff; i++) {
            const item = a[i];
            map[item.id] = i;
        }
        for (let i = start; i < end; i++) {
            const item = b[i];
            const pos = map[item.id];
            if (pos === undefined) {
                res.push([-1, handleType(item)]);
            } else {
                if (a[pos] === b[i]) {
                    res.push(pos);
                } else {
                    const diffRes = diff(a[pos], b[i]);
                    res.push([pos, diffRes]);
                }
            }
        }
    }
    if (end < b.length) res.push(-(b.length - end));
    return res;
}

export function diff(a: any, b: any) {
    if (a === b) {
        return {};
    }
    if (isObject(a) && isObject(b) && a.constructor === b.constructor) {
        // objects
        if (a.constructor === Object) {
            const ret: any = {};
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
                    ret[key] = diff(a[key], b[key]);
                }
            }
            return ret;
        }
        if (a instanceof Array) {
            return diffA(a, b);
        }
        return handleType(b);
    }
    return handleType(b);
}

function patchArray(oldArr: any[], p: any[]) {
    const newArr = [];
    if (p[1] < 0) {
        const left = -p[1];
        for (let i = 0; i < left; i++) {
            newArr.push(oldArr[i]);
        }
    }
    for (let i = 1; i < p.length; i++) {
        const item = p[i];
        if (item >= 0) {
            newArr.push(oldArr[item]);
        } else if (item < 0) {
        } else if (Array.isArray(item)) {
            if (item[0] === -1) {
                newArr.push(item[1]);
            } else {
                newArr.push(patch(oldArr[item[0]], item[1]));
            }
        } else {
            console.error('Unexpected patch value: ' + JSON.stringify(item));
        }
    }
    if (p[p.length - 1] < 0) {
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

export function patch(old: any, p: any): any {
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
        const newObj: any = {};
        const keys = Object.keys(p);
        const appliedKeys: any = {};
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
