import {Atom} from "./index";
import {prop} from "./prop";

export class ArrayIndex<T> {
    constructor(protected key:ArrayIndexKey<T>, protected source:ImmutableArray<T>) {}

    @prop get index() {
        const index:{[value:string]:ImmutableArray<T>} = {};
        for (var i = 0; i < this.source.length; i++) {
            const item = this.source.get(i);
            const value = this.key.predicate(item);
            let valueIndex = index[value];
            let items:T[];
            if (!valueIndex) {
                items = [];
                valueIndex = index[value] = new ImmutableArray(items);
            } else {
                items = (valueIndex as any).items;
            }
            items.push(item)
        }
        return index;
    }
}

export class ArrayIndexKey<T> {
    private static id = 0;
    public id = ++ArrayIndexKey.id;

    constructor(public predicate:(item:T)=>string | number) {}
}


export class ImmutableArray<T> {
    protected static emptyList = new ImmutableArray<{}>([]);

    protected items:T[];

    get length() {
        return this.items.length;
    }

    constructor(items:T[] = []) {
        this.items = items;
    }

    protected index:{[key:string]:ArrayIndex<T>}

    get first() {
        return this.items[0];
    }

    get last() {
        return this.items[this.items.length - 1];
    }

    get isEmpty() {
        return this.items.length === 0;
    }

    get isNotEmpty() {
        return this.items.length !== 0;
    }

    includes(value:T) {
        return this.items.indexOf(value) > -1;
    }

    intersection(array:T[]) {
        const items:T[] = [];
        for (let i = 0; i < this.items.length; i++) {
            var item = this.items[i];
            for (let j = 0; j < array.length; j++) {
                if (item === array[j]) {
                    items.push(item);
                }
            }
        }
        return items;
    }

    unique() {
        const items:T[] = [];
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            let found = false;
            for (let j = 0; j < this.items.length; j++) {
                if (item === this.items[j]) {
                    found = true;
                }
            }
            if (!found) {
                items.push(item);
            }
        }
        return items;
    }

    firstWhere(cb:(item:T)=>boolean, skipIfNotFound?:boolean) {
        for (var i = 0; i < this.items.length; i++) {
            var item = this.items[i];
            if (cb(item)) {
                return item;
            }
        }
        if (!skipIfNotFound) {
            throw new Error('Item not found');
        }
        return null;
    }

    getAllBy(indexKey:ArrayIndexKey<T>, value:string | number) {
        if (!this.index) {
            this.index = {};
        }
        let keyIndex = this.index[indexKey.id];
        if (!keyIndex) {
            keyIndex = this.index[indexKey.id] = new ArrayIndex(indexKey, this);
        }
        let valueIndex = keyIndex.index[value];
        return valueIndex || ImmutableArray.emptyList as ImmutableArray<T>;
    }

    getBy(indexKey:ArrayIndexKey<T>, value:string | number) {
        return this.getAllBy(indexKey, value).items[0];
    }

    get(index:number) {
        return this.items[index];
    }

    concat<U extends T[]>(...items:U[]):T[];
    concat(...items:T[]):T[]
    concat() {
        return this.items.concat.apply(this.items, arguments);
    }

    join(separator?:string):string {
        return this.items.join(separator);
    }

    slice(start?:number, end?:number):T[] {
        return this.items.slice(start, end);
    }

    indexOf(searchElement:T, fromIndex?:number):number {
        return this.items.indexOf(searchElement, fromIndex);
    }

    lastIndexOf(searchElement:T, fromIndex?:number):number {
        return this.items.lastIndexOf(searchElement, fromIndex);
    }

    every(callbackfn:(value:T, index:number, array:T[]) => boolean, thisArg?:{}):boolean {
        return this.items.every(callbackfn, thisArg);
    }

    some(callbackfn:(value:T, index:number, array:T[]) => boolean, thisArg?:{}):boolean {
        return this.items.some(callbackfn, thisArg);
    }

    forEach(callbackfn:(value:T, index:number, array:T[]) => void, thisArg?:{}):void {
        return this.items.forEach(callbackfn, thisArg);
    }

    map<U>(callbackfn:(value:T, index:number, array:T[]) => U, thisArg?:{}):U[] {
        return this.items.map(callbackfn, thisArg);
    }

    filter(callbackfn:(value:T, index:number, array:T[]) => boolean, thisArg?:{}) {
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

    toString() {
        return this.items.toString();
    }
}

export class AtomArray<T> extends ImmutableArray<T> {
    @prop protected items:T[];

    protected mutate() {
        this.items = Atom.forceUpdateValue;
    }

    push(...items:T[]):number;
    push():number {
        const result = this.items.push.apply(this.items, arguments);
        this.mutate();
        return result;
    }

    set(index:number, value:T) {
        this.items[index] = value;
        this.mutate();
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

    splice(start:number, deleteCount?:number, ...items:T[]):T[]
    splice():T[] {
        const result = this.items.splice.apply(this.items, arguments);
        this.mutate();
        return result;
    }

    unshift(...items:T[]):number;
    unshift():number {
        const result = this.items.unshift.apply(this.items, arguments);
        this.mutate();
        return result;
    }

    add(item:T) {
        this.items.push(item);
        this.mutate();
    }

    addAll(items:T[]) {
        this.items.push.apply(this.items, items);
        this.mutate();
    }

    clear() {
        for (var i = 0, len = this.items.length; i < len; i++) {
            this.items.pop();
        }
        this.mutate();
    }

    remove(item:T) {
        const pos = this.items.indexOf(item);
        if (pos > -1) {
            this.splice(pos, 1);
            return true;
        }
        return false;
    }

}


/*

 class X {
 @prop id:number;
 @prop name:string;
 @prop tid:number;

 constructor(id:number, name:string, tid:number) {
 this.id = id;
 this.name = name;
 this.tid = tid;
 }

 toString() {
 return `id: ${this.id}, name: ${this.name}, tid: ${this.tid}`;
 }
 }

 const arr = new BaseArray([
 new X(1, 'One', 100),
 new X(2, 'Two', 100),
 new X(3, 'Three', 200),
 new X(4, 'Four', 200),
 ]);

 window.X = X;

 window.arr = arr;

 @autowatch
 class Comp extends React.Component<{}, {}> {
 render() {
 return <div>
 {arr.getBy('tid', 100).map(item => <div>id: {item.id}, {item.name}, {item.tid}</div>)}
 {arr.getXBy('id', 3).map(item => <div>id: {item.id}, {item.name}, {item.tid}</div>)}
 </div>
 }
 }

 ReactDOM.render(<Comp/>, document.querySelector('#main'));*/
