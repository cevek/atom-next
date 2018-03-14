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
    // console.log({ start, end, a: a.length, b: b.length });

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
    // console.log('pa', oldArr, p);
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
    // console.log(old, p);
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
        const newObj: any = {}; //Object.assign({}, old);
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

function deepEqual(x: any, y: any) {
    if (typeof x == 'object' && x != null && (typeof y == 'object' && y != null)) {
        if (Object.keys(x).length != Object.keys(y).length) return false;
        for (let prop in x) {
            if (y.hasOwnProperty(prop)) {
                if (!deepEqual(x[prop], y[prop])) return false;
            } else return false;
        }
        return true;
    } else return x === y;
}

function test(a: any, b: any, expected: any) {
    const patchO = diff(a, b);
    const restored = patch(a, patchO);
    const strTransformed = JSON.stringify(b);
    const strPatch = JSON.stringify(patchO);
    const strExpected = JSON.stringify(expected, Object.keys(expected).sort());
    const strRestored = JSON.stringify(restored, Object.keys(restored).sort());

    // console.log({ a, b, patchO, restored, expected });

    if (!deepEqual(patchO, expected)) {
        console.error(`diff results are not equal\n  expected: ${strExpected}\n     given: ${strPatch}`);
    } else if (!deepEqual(b, restored)) {
        console.error(`patch results are not equal\n  expected: ${strTransformed}\n     given: ${strRestored}`);
    } else {
        console.log('ok');
    }
}

const arr: { id: number }[] = [];
for (let i = 0; i < 20; i++) {
    arr.push({ id: i });
}
function testArray(a: number[], b: number[], expected: any[]) {
    return test(a.map(id => arr[id]), b.map(id => arr[id]), [Code.PATCH_ARRAY, ...expected]);
}

function tests() {
    // objects
    test({ b: undefined }, { b: 1 }, { b: 1 });
    test({ a: 1 }, { a: undefined }, { a: ['undefined'] });
    test({ a: 1 }, { b: 1 }, { a: ['del'], b: 1 });

    test({ a: 1, b: { c: { d: 1 } } }, { b: 1 }, { a: ['del'], b: 1 });
    test({ b: 1 }, { a: 1, b: { c: { d: 1 } } }, { a: 1, b: { c: { d: 1 } } });
    test(
        { a: { b: { c: 1, d: 3 }, e: 4 }, f: 5 },
        { a: { b: { c: 2, d: 6 }, e: 4 }, f: 9 },
        { a: { b: { c: 2, d: 6 } }, f: 9 }
    );

    // arrays
    test(
        [{ id: 1, name: { foo: 1, bar: 'a' } }, { id: 2, name: { foo: 2 } }],
        [{ id: 2, name: { foo: 1 } }, { id: 1, name: { foo: 2, bar: 'a' } }],
        [Code.PATCH_ARRAY, [1, { name: { foo: 1 } }], [0, { name: { foo: 2 } }]]
    );
    testArray([1, 2], [2, 1], [1, 0]);
    testArray([1, 2, 3], [2, 3, 1], [1, 2, 0]);
    testArray([1, 2, 3, 4], [2, 4, 3, 1], [1, 3, 2, 0]);
    testArray([1, 2, 3, 4], [1, 2, 4, 3], [-2, 3, 2]);
    testArray([1, 2, 3, 4], [4, 2, 3, 1], [3, 1, 2, 0]);
    testArray([1, 2, 3, 4], [4, 2, 3, 1, 5], [3, 1, 2, 0, [-1, { id: 5 }]]);
    testArray([1, 2, 3, 4], [8, 2, 7, 1, 5], [[-1, { id: 8 }], 1, [-1, { id: 7 }], 0, [-1, { id: 5 }]]);
    testArray([1, 3], [1, 3, 5], [-2, [-1, { id: 5 }]]);
    testArray([], [], []);
    testArray([1], [2], [[-1, { id: 2 }]]);
    testArray([], [2], [[-1, { id: 2 }]]);
    testArray([7, 3, 1], [7, 2, 1], [-1, [-1, { id: 2 }], -1]);
    testArray([1, 2, 3, 4], [7, 1, 2, 3, 4], [[-1, { id: 7 }], -4]);

    //date
    test({ a: new Date() }, { a: new Date(Date.UTC(2018, 0)) }, { a: ['d', '2018-01-01T00:00:00.000Z'] });

    // deep array
    test(
        { a: [{ id: 1, b: [{ id: 2, c: [{ id: 3, d: 4 }] }] }] },
        { a: [{ id: 1, b: [{ id: 2, c: [{ id: 3, d: 40 }] }] }] },
        { a: ['pa', [0, { b: ['pa', [0, { c: ['pa', [0, { d: 40 }]] }]] }]] }
    );
}

// tests();


