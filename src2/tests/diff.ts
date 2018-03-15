import { diff, patch } from '../diff';

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
    return test(a.map(id => arr[id]), b.map(id => arr[id]), ['pa', ...expected]);
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
        ['pa', [1, { name: { foo: 1 } }], [0, { name: { foo: 2 } }]]
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

tests();
