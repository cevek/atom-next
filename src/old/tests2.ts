import { Atom, run, AtomValue, AtomCalc } from '../atom';

const seed = new AtomValue(1, 'seed');
const b = new AtomCalc(() => {
    return seed.get() + 10;
}, 'b');
const c = new AtomCalc(() => {
    return 5 + b.get();
}, 'c');
const d = new AtomCalc(() => {
    return c.get();
}, 'd');

const y = new AtomCalc(() => {
    return new AtomValue(103);
});
// const x = AtomCalc.autorun(() => {
//     var xx = new AtomValue(103, 'inner');
//     xx.get();
//     xx.set(100);
//     run();
//     debugger;
// }, 'outer');

// const e = new AtomCalc(() => {
//     return b.get();
// }, 'e');

var autorun = AtomCalc.autorun(() => {
    return d.get();
}, 'autorun');

// declare const global: any;
// global.seed = seed;
// global.b = b;
// global.c = c;
// global.d = d;

console.log(d.get());
seed.set(2);
seed.set(3);

// // console.log(seed.slaves[0]);
// // console.log(c);

// // d.get();
// // console.log(d.get());
// // console.log(autorun);
run();
