import { Atom, run } from './atom';

const seed = Atom.value(1, 'seed');
const b = Atom.calc(() => {
    return seed.get() + 10;
}, 'b');
const c = Atom.calc(() => {
    return 5 + b.get();
}, 'c');
const d = Atom.calc(() => {
    return c.get();
}, 'd');

var autorun = Atom.autorun(() => {
    return d.get();
}, 'autorun');

declare const global: any;
global.seed = seed;
global.b = b;
global.c = c;
global.d = d;

console.log(d.get());
seed.set(2);
seed.set(3);

// d.get();
// console.log(d.get());
// console.log(autorun);
run();
