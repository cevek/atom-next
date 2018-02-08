// const promise = typeof window === 'undefined' ? set (window as any).Promise.resolve();

export interface HMap<T> {
    [key: number]: T;
}

export enum AtomStatus {
    PROP = 1,
    GETTER_NO_VAL = 2,
    GETTER = 3,
    DESTROYED = -1,
    CALCULATING = 10,
}

export enum TaskType {
    CHANGE = 10,
    DESTROY = 50,
    MODIFY = 100,
    MODIFY_STATUS = 200,
}

export interface IDMap<T> {
    [id: number]: T;
}

export class Shared {
    list: (Atom | number)[] = [];
    len = 0;
    counter = 0;
}

export class TaskList {
    pos = 0;
    donePos = 0;
    asyncRunned = false;
    queue: any[];
    size = 50000;

    get list() {
        const items: any = [];
        for (let i = this.donePos; i < this.pos; i += 3) {
            const pos = i % this.size;
            const type: TaskType = this.queue[pos];
            items.push({
                type: type,
                atom: this.queue[pos + 1],
                atomName: this.queue[pos + 1].field,
                slave: this.queue[pos + 2],
            });
        }
        return items;
    }

    get namedList() {
        const items: string[] = [];
        for (let i = this.donePos; i < this.pos; i += 3) {
            const pos = i % this.size;
            items.push(this.queue[pos + 1].field);
        }
        return items;
    }

    constructor(public taskRunner: () => void) {
        this.queue = [];
    }

    static microTaskRunner = (callback: () => void) => setTimeout(callback);

    addTask(taskType: TaskType, atom: Atom, param?: any) {
        if (!this.asyncRunned) {
            this.asyncRunned = true;
            TaskList.microTaskRunner(this.taskRunner);
        }
        const pos = this.pos % this.size;
        this.queue[pos] = taskType;
        this.queue[pos + 1] = atom;
        if (param) {
            this.queue[pos + 2] = param;
        }
        this.pos += 3;
    }

    iterateUndone(callback: (type: TaskType, atom: Atom, param: any, isLast: boolean) => void) {
        if (this.pos - this.donePos > this.size) {
            throw new Error('Out of range');
        }
        for (let i = this.donePos; i < this.pos; i += 3) {
            const pos = i % this.size;
            const type: TaskType = this.queue[pos];
            callback(
                type,
                this.queue[pos + 1],
                type === TaskType.MODIFY ? this.queue[pos + 2] : void 0,
                i === this.pos - 3
            );
            this.donePos += 3;
        }
        this.asyncRunned = false;
    }
}

class AtomStatic {
    activeSlave?: AtomCalc = void 0;
    atomId = 0;
    debugAtoms?: { [id: string]: boolean } = void 0;
    forceUpdateValue: {} = {};

    shared: Shared = undefined!;
    sharedCache: Shared[] = [];
    sharedCachePos = -1;

    counter = 0;

    scheduledTasks = new TaskList(() => this.updateScheduled);

    debugAtom(name: string) {
        if (this.debugAtoms === void 0) {
            this.debugAtoms = {};
        }
        this.debugAtoms[name] = true;
    }

    debug() {
        debugger;
    }

    getAtom(callback: () => void, thisArg?: any) {
        const prevShared = this.shared;
        const oldActiveSlave = this.activeSlave;
        this.activeSlave = serviceAtom;
        this.shared = this.sharedCachePos === -1 ? new Shared() : this.sharedCache[this.sharedCachePos--];
        this.shared.len = 0;
        callback.call(thisArg);
        if (this.shared.len === 0) {
            throw new Error('Atom not found');
        }
        const atom = this.shared.list[0] as Atom;
        this.shared = prevShared;
        this.activeSlave = oldActiveSlave;
        return atom;
    }

    updateScheduled() {
        // console.log("start schedule runner");
        let prevType: TaskType | undefined = void 0;
        let transactionId = -1;
        let transactionStartPos = -1;
        let i = 0;

        const sc = this.scheduledTasks;
        if (sc.pos - sc.donePos > sc.size) {
            throw new Error('Out of range');
        }
        for (i = sc.donePos; i < sc.pos; i += 3) {
            const pos = i % sc.size;
            const type: TaskType = sc.queue[pos];
            const atom: Atom = sc.queue[pos + 1];
            const param = type === TaskType.MODIFY ? sc.queue[pos + 2] : void 0;

            if (type === TaskType.CHANGE) {
                if (transactionId === -1) {
                    transactionId = ++this.counter;
                    transactionStartPos = i;
                }
                atom.affect(transactionId);
            } else if (prevType === TaskType.CHANGE) {
                for (let j = transactionStartPos; j < i; j += 3) {
                    const atom = sc.queue[j % sc.size + 1];
                    atom.update(transactionId);
                }
                transactionId = -1;
            }
            if (type === TaskType.MODIFY) {
                (atom as AtomCalc).applyModify(param);
            } else if (type === TaskType.MODIFY_STATUS) {
                atom.status = param;
            } else if (type === TaskType.DESTROY) {
                atom.realDestroy();
            }
            prevType = type;
            sc.donePos += 3;
        }
        if (transactionId > -1) {
            for (let j = transactionStartPos; j < i; j += 3) {
                const atom = sc.queue[j % sc.size + 1];
                atom.update(transactionId);
            }
        }

        sc.asyncRunned = false;
    }
}

const atomStatic = new AtomStatic();

export class Atom {
    id = ++atomStatic.atomId;
    slaves?: Atom[] = undefined;
    slavesMap?: HMap<number> = void 0;
    masters?: Atom[] = void 0;
    mastersMap?: HMap<number> = void 0;
    status = AtomStatus.PROP;
    field = '';
    value?: {} = void 0;
    owner?: {} = void 0;
    counter = 0;
    calcFn?: () => void = void 0;
    creatorId?: number = void 0;

    constructor() {}

    prop(field: string, value: {}): this {
        this.value = value;
        this.field = field;
        this.status = AtomStatus.PROP;
        this.creatorId = atomStatic.activeSlave !== void 0 ? atomStatic.activeSlave.id : void 0;
        return this;
    }

    getter(field: string, owner?: {}, calcFn?: () => void): AtomCalc {
        this.field = field;
        this.calcFn = calcFn;
        this.owner = owner;
        this.masters = [];
        this.status = AtomStatus.GETTER_NO_VAL;
        return this as AtomCalc;
    }

    getWithCalc(this: AtomCalc) {
        if (this.status === AtomStatus.GETTER_NO_VAL) {
            this.calc();
        }
        return this.get();
    }

    getWithForceCalc(this: AtomCalc) {
        this.calc();
        return this.get();
    }

    get() {
        //this.checkForDestroy();
        const activeSlave = atomStatic.activeSlave;
        if (activeSlave !== void 0 && this.creatorId !== activeSlave.id) {
            const activeSlaveMasters = activeSlave.masters;
            const len = activeSlaveMasters.length;
            const shared = atomStatic.shared;
            // if find self in activeSlave masters exit
            const k = shared.counter;
            for (let i = 0; i < len; i++) {
                if (activeSlaveMasters[i] === this) {
                    shared.list[i] = k;
                    return this.value;
                }
            }
            // if find self in added list exit
            const sharedLen = shared.len;
            for (let j = len; j < sharedLen; j++) {
                if (shared.list[j] === this) {
                    return this.value;
                }
            }
            // add self to added list
            shared.list[shared.len++] = this;
        }
        return this.value;
    }

    set(value: any) {
        this.checkForDestroy();
        if (value === atomStatic.forceUpdateValue) {
            atomStatic.scheduledTasks.addTask(TaskType.CHANGE, this);
            return;
        }
        if (this.value !== value) {
            this.value = value;
            atomStatic.scheduledTasks.addTask(TaskType.CHANGE, this);
        }
    }

    change() {
        this.checkForDestroy();
        atomStatic.scheduledTasks.addTask(TaskType.CHANGE, this);
    }

    destroy() {
        this.checkForDestroy();
        if (atomStatic.debugAtoms !== void 0 && (atomStatic.debugAtoms[this.field] || atomStatic.debugAtoms[this.id])) {
            atomStatic.debug();
        }
        this.status = AtomStatus.DESTROYED;
        atomStatic.scheduledTasks.addTask(TaskType.DESTROY, this);
    }

    realDestroy() {
        this.clearMasters();
        this.clearSlaves();
        // this.value = null;
        this.owner = void 0;
        this.calcFn = void 0;
    }

    checkForDestroy() {
        if (this.status === AtomStatus.DESTROYED) {
            throw new Error('Try to use destroyed atom');
        }
    }

    calc(this: AtomCalc) {
        const oldActiveSlave = atomStatic.activeSlave;
        atomStatic.activeSlave = this as AtomCalc;
        const prevShared = atomStatic.shared;
        atomStatic.shared =
            atomStatic.sharedCachePos === -1 ? new Shared() : atomStatic.sharedCache[atomStatic.sharedCachePos--];
        atomStatic.shared.len = this.masters.length;
        this.counter = atomStatic.shared.counter = ++atomStatic.counter;
        const oldValue = this.value;
        this.value = this.calcFn.call(this.owner);
        atomStatic.scheduledTasks.addTask(TaskType.MODIFY, this, atomStatic.shared);
        // this.applyModify(Atom.shared);
        atomStatic.shared = prevShared;
        atomStatic.activeSlave = oldActiveSlave;
        if (this.status !== AtomStatus.CALCULATING) {
            this.status = AtomStatus.GETTER;
        }
        // Atom.scheduledTasks.addTask(TaskType.MODIFY_STATUS, this, AtomStatus.GETTER);
        // console.info(this.field, this.id);
        return oldValue !== this.value;
    }

    applyModify(this: AtomCalc, shared: Shared) {
        if (this.counter !== shared.counter) {
            return;
        }
        const k = shared.counter;
        const masters = this.masters;
        const len = masters.length;

        // find and remove old masters
        let removeCount = 0;
        for (let i = 0; i < len; i++) {
            if (removeCount > 0) {
                masters[i - removeCount] = masters[i];
            }
            if (shared.list[i] !== k) {
                this.removeSelfFromList(masters[i].slaves!);
                removeCount++;
            }
        }
        for (let i = 0; i < removeCount; i++) {
            masters.pop();
        }

        for (let i = len; i < shared.len; i++) {
            const atom = shared.list[i] as Atom;
            masters.push(atom);
            if (atom.slaves === void 0) {
                atom.slaves = [];
            }
            atom.slaves.push(this);
        }

        atomStatic.sharedCache[++atomStatic.sharedCachePos] = shared;
    }

    clearMasters() {
        const masters = this.masters;
        if (masters !== void 0) {
            for (let i = 0, len = masters.length; i < len; i++) {
                this.removeSelfFromList(masters[i].slaves!);
            }
            this.masters = void 0;
        }
    }

    clearSlaves() {
        const slaves = this.slaves;
        if (slaves !== void 0) {
            for (let i = 0, len = slaves.length; i < len; i++) {
                this.removeSelfFromList(slaves[i].masters!);
            }
            this.slaves = void 0;
        }
    }

    removeSelfFromList(items: Atom[]) {
        let found = false;
        for (let i = 0, len = items.length; i < len; i++) {
            if (found) {
                items[i - 1] = items[i];
            } else if (items[i] === this) {
                found = true;
            }
        }
        if (found) {
            items.pop();
        }
    }

    affect(transactionId: number) {
        if (this.counter !== transactionId) {
            this.counter = transactionId;
            if (this.status === AtomStatus.GETTER) {
                this.status = AtomStatus.CALCULATING;
            }
            const slaves = this.slaves;
            if (slaves !== void 0) {
                for (let i = 0, len = slaves.length; i < len; i++) {
                    slaves[i].affect(transactionId);
                }
            }
        }
    }

    updateCalc(this: AtomCalc) {
        return this.calc();
    }

    update(transactionId: number) {
        const masters = this.masters;
        if (masters !== void 0 && masters.length > 1) {
            for (let i = 0, len = masters.length; i < len; i++) {
                const master = masters[i];
                if (master.counter === transactionId && master.status === AtomStatus.CALCULATING) {
                    return;
                }
            }
        }
        if (atomStatic.debugAtoms !== void 0 && (atomStatic.debugAtoms[this.field] || atomStatic.debugAtoms[this.id])) {
            atomStatic.debug();
        }
        // if (this.status == AtomStatus.GETTER) {
        //     throw new Error('Atom yet calculated');
        // }
        if (this.status === AtomStatus.CALCULATING) {
            (this as AtomCalc).updateCalc();
            this.status = AtomStatus.GETTER;
        }
        const slaves = this.slaves;
        if (slaves !== void 0) {
            for (let i = 0; i < slaves.length; i++) {
                slaves[i].update(transactionId);
            }
        }
    }
}
export class AtomProp extends Atom {
    slaves: AtomCalc[] = [];
    slavesMap: HMap<number> = {};
}
export class AtomCalc extends Atom {
    slaves: AtomCalc[] = [];
    slavesMap: HMap<number> = {};
    masters: Atom[] = [];
    mastersMap: HMap<number> = {};
    calcFn: () => void = undefined!;
}

const serviceAtom = new Atom().getter('private', void 0, void 0);

// (window as any).debugAtom = atomStatic.debugAtom;

export * from './autowatch';
export * from './atom-array';
export * from './prop';
/*
 const a1 = new Atom().prop('a1', 1);
 const a2 = new Atom().prop('a2', 2);
 const a3 = new Atom().prop('a3', 3);
 const a4 = new Atom().prop('a4', 4);
 const a5 = new Atom().prop('a5', 5);
 const a6 = new Atom().prop('a6', 6);
 const a7 = new Atom().prop('a7', 7);
 const a8 = new Atom().prop('a8', 8);
 const a9 = new Atom().prop('a9', 9);
 const a0 = new Atom().prop('a0', 0);

 const b1 = new Atom().prop('a1', 1);
 const b2 = new Atom().prop('a2', 2);
 const b3 = new Atom().prop('a3', 3);
 const b4 = new Atom().prop('a4', 4);
 const b5 = new Atom().prop('a5', 5);
 const b6 = new Atom().prop('a6', 6);
 const b7 = new Atom().prop('a7', 7);
 const b8 = new Atom().prop('a8', 8);
 const b9 = new Atom().prop('a9', 9);
 const b0 = new Atom().prop('a0', 0);

 let x = 0;
 const sum = new Atom().getter('sum', {}, () => {
 a1.get();
 a2.get();
 a3.get();
 a4.get();
 a5.get();
 a6.get();
 a7.get();
 a8.get();
 a9.get();
 a0.get();
 //
 // return x++ % 2 == 0 ? a.get() : b.get();
 });*/

/*
 function abc() {
 console.time('perf');
 for (const i = 0; i < 1000000; i++) {
 sum.calc();
 // Atom.updateScheduled();
 }
 console.timeEnd('perf');
 }
 */

// abc();

atomStatic.debug

const a = new Atom().prop('a', '[A]');
const b = new Atom().prop('b', '[B]');
const c = new Atom().prop('c', '[C]');

let x = 0;
const sum = new Atom().getter('sum', void 0, () => {
    c.get();
    return x++ % 2 == 0 ? a.get() : b.get();
});
sum.get();
atomStatic.updateScheduled();

a.set('[A1]');
atomStatic.updateScheduled();

b.set('[B1]');
atomStatic.updateScheduled();



/*

 const render = new Atom().getter('render', null, () => {
 x++;
 const val = (x % 2 == 0 ? b.get() : (a.get() + sum.get()));
 console.log('render', val);
 })
 render.get();
 a.set('[A1]');
 setTimeout(() => {
 a.set('[A0]');
 setTimeout(() => {
 a.set('[Ax]');
 });
 });
 */
