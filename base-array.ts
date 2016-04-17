import {Atom} from "./index";
import {prop} from "./prop";
export class BaseArray<T> {
    @prop protected items:T[];

    @prop get length() {
        return this.items.length;
    }

    constructor(items:T[]) {
        this.items = items || [];
    }

    protected getAtomCallback() {
        return this.items;
    }

    protected atom:Atom = Atom.getAtom(this.getAtomCallback, this);


    protected mutate() {
        this.atom.change();
    }

    push(...items:T[]) {
        const result = this.items.push(...items);
        this.mutate();
        return result;
    }

    set(index:number, value:T) {
        this.items[index] = value;
        this.mutate();
    }

    get(index:number) {
        return this.items[index];
    }

    pop() {
        const result = this.items.pop();
        this.mutate();
        return result;
    }

    reverse() {
        const result = this.items.reverse();
        this.mutate();
        return result;

    }

    shift() {
        const result = this.items.shift();
        this.mutate();
        return result;

    }


    sort(compareFn?:(a:T, b:T) => number) {
        const result = this.items.sort(compareFn);
        this.mutate();
        return result;

    }

    splice(start:number, deleteCount?:number, ...items:T[]) {
        const result = this.items.splice(start, deleteCount, ...items);
        this.mutate();
        return result;

    }

    unshift(...items:T[]) {
        const result = this.items.unshift(...items);
        this.mutate();
        return result;

    }

    concat<U extends T[]>(...items:U[]):T[];
    concat(...items:T[]) {
        return this.items.concat(...items);
    }

    join(separator?:string) {
        return this.items.join(separator);
    }

    slice(start?:number, end?:number) {
        return this.items.slice(start, end);
    }

    indexOf(searchElement:T, fromIndex?:number) {
        return this.items.indexOf(searchElement, fromIndex);
    }

    lastIndexOf(searchElement:T, fromIndex?:number) {
        return this.items.lastIndexOf(searchElement, fromIndex);
    }

    every(callbackfn:(value:T, index:number, array:T[]) => boolean, thisArg?:any) {
        return this.items.every(callbackfn, thisArg);
    }

    some(callbackfn:(value:T, index:number, array:T[]) => boolean, thisArg?:any) {
        return this.items.some(callbackfn, thisArg);
    }

    forEach(callbackfn:(value:T, index:number, array:T[]) => void, thisArg?:any) {
        return this.items.forEach(callbackfn, thisArg);
    }

    map<U>(callbackfn:(value:T, index:number, array:T[]) => U, thisArg?:any) {
        return this.items.map(callbackfn, thisArg);
    }

    filter(callbackfn:(value:T, index:number, array:T[]) => boolean, thisArg?:any) {
        return this.items.filter(callbackfn, thisArg);
    }

    reduce(callbackfn:(previousValue:T, currentValue:T, currentIndex:number, array:T[]) => T, initialValue?:T):T;
    reduce<U>(callbackfn:(previousValue:U, currentValue:T, currentIndex:number, array:T[]) => U, initialValue:U) {
        return this.items.reduce(callbackfn, initialValue);
    }

    reduceRight(callbackfn:(previousValue:T, currentValue:T, currentIndex:number, array:T[]) => T, initialValue?:T):T;
    reduceRight<U>(callbackfn:(previousValue:U, currentValue:T, currentIndex:number, array:T[]) => U, initialValue:U) {
        return this.items.reduceRight(callbackfn, initialValue);
    }
}
