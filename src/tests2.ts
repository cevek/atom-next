import { Atom, run } from './atom';

const seed = Atom.value(1, 'seed');
const b = Atom.calc(() => {
    return seed.get() + 10 + e.get();
}, 'b');
const c = Atom.calc(() => {
    return 5 + b.get();
}, 'c');
const d = Atom.calc(() => {
    return c.get();
}, 'd');

const y = Atom.calc(() => {
    return Atom.value(103);
});
// const x = Atom.autorun(() => {
//     var xx = Atom.value(103, 'inner');
//     xx.get();
//     xx.set(100);
//     run();
//     debugger;
// }, 'outer');

const e = Atom.calc(() => {
    return b.get();
}, 'e');

var autorun = Atom.autorun(() => {
    return d.get();
}, 'autorun');

// declare const global: any;
// global.seed = seed;
// global.b = b;
// global.c = c;
// global.d = d;

// console.log(d.get());
seed.set(2);
// seed.set(3);

// // console.log(seed.slaves[0]);
// // console.log(c);

// // d.get();
// // console.log(d.get());
// // console.log(autorun);
run();
