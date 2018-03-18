import { diff, patch } from '../Diff';

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
    const strExpected = JSON.stringify(expected);
    const strRestored = JSON.stringify(restored);

    // console.log({ a, b, patchO, restored, expected });

    if (!deepEqual(patchO, expected)) {
        console.log(`diff results are not equal\n  expected: ${strExpected}\n     given: ${strPatch}`);
    } else if (!deepEqual(b, restored)) {
        console.log(`patch results are not equal\n  expected: ${strTransformed}\n     given: ${strRestored}`);
    } else {
        console.log('ok');
    }
}

const arr: { id: number }[] = [];
for (let i = 0; i < 20; i++) {
    arr.push({ id: i });
}
function testArray(a: number[], b: number[], expected: any[]) {
    return test(a.map(id => arr[id]), b.map(id => arr[id]), ['patchArray', ...expected]);
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
        ['patchArray', ['patch', 1, { name: { foo: 1 } }], ['patch', 0, { name: { foo: 2 } }]]
    );
    testArray([1, 2], [1, 2], [-2]);
    testArray([1, 2, 3, 4, 5], [1, 2, 4, 5], [-2, -2]);
    testArray([1, 2, 4, 5], [1, 2, 3, 4, 5], [-2, ['new', { id: 3 }], -2]);
    testArray([1, 2], [2, 1], [1, 0]);
    testArray([1, 2, 3], [2, 3, 1], [1, 2, 0]);
    testArray([1, 2, 3, 4], [2, 4, 3, 1], [1, 3, 2, 0]);
    testArray([1, 2, 3, 4], [1, 2, 4, 3], [-2, 3, 2]);
    testArray([1, 2, 3, 4], [4, 2, 3, 1], [3, 1, 2, 0]);
    testArray([1, 2, 3, 4], [4, 2, 3, 1, 5], [3, 1, 2, 0, ['new', { id: 5 }]]);
    testArray([1, 2, 3, 4], [8, 2, 7, 1, 5], [['new', { id: 8 }], 1, ['new', { id: 7 }], 0, ['new', { id: 5 }]]);
    testArray([1, 3], [1, 3, 5], [-2, ['new', { id: 5 }]]);
    testArray([], [], []);
    testArray([1], [2], [['new', { id: 2 }]]);
    testArray([], [2], [['new', { id: 2 }]]);
    testArray([7, 3, 1], [7, 2, 1], [-1, ['new', { id: 2 }], -1]);
    testArray([1, 2, 3, 4], [7, 1, 2, 3, 4], [['new', { id: 7 }], -4]);

    //date
    test({ a: new Date() }, { a: new Date(Date.UTC(2018, 0)) }, { a: ['date', '2018-01-01T00:00:00.000Z'] });

    // deep array
    test(
        { a: [{ id: 1, b: [{ id: 2, c: [{ id: 3, d: 4 }] }] }] },
        { a: [{ id: 1, b: [{ id: 2, c: [{ id: 3, d: 40 }] }] }] },
        {
            a: [
                'patchArray',
                ['patch', 0, { b: ['patchArray', ['patch', 0, { c: ['patchArray', ['patch', 0, { d: 40 }]] }]] }],
            ],
        }
    );

    // array of numbers
    test([1, 2, 3], [1, 2, 3], ['patchArray', -3]);
    test([1, 2, 3], [3, 2, 1], ['patchArray', 2, 1, 0]);
    test([1, 2, 4, 5], [1, 2, 3, 4, 5], ['patchArray', -2, ['new', 3], -2]);

    // set array
    test([1], [[3, 4]], ['patchArray', ['new', ['array', [3, 4]]]]);
}

tests();
