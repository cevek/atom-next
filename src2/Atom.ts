import { toJSON } from './Utils';

export const enum AtomState {
    ACTUAL = 'ACTUAL',
    MAYBE_DIRTY = 'MAYBE_DIRTY',
    DIRTY = 'DIRTY',
}

class Transaction {
    changes: number[] = [];
    changesLength = 0;
    constructor(public transactionId: number, public atom?: AtomCalc) {}
}

class TransactionManager {
    private transactionIdIdx = 0;
    current = new Transaction(this.transactionIdIdx++, undefined);
    private stack: Transaction[] = [this.current];
    private pos = 0;
    digestRunning = false;
    start(atom: AtomCalc) {
        if (this.pos === this.stack.length - 1) {
            this.stack.push(new Transaction(this.transactionIdIdx++, atom));
        }
        this.possibleToUseAtomAsSlave(atom);
        this.current = this.stack[++this.pos];
        this.current.changesLength = atom.masters.length;
        this.current.atom = atom;
        if (this.current.changesLength > this.current.changes.length) {
            this.current.changes[this.current.changesLength - 1] = -1;
        }
    }

    end() {
        this.current.atom = void 0;
        this.current = this.stack[--this.pos];
    }

    possibleToUseAtomAsSlave(atom: Atom) {
        for (let i = 1; i <= this.pos; i++) {
            const transaction = this.stack[i];
            if (transaction.atom === atom) {
                const path = [];
                for (let j = i; j <= this.pos; j++) {
                    path.push(this.stack[j].atom!.name);
                }
                throw new Error(`Cyclic dependency detected: ${path.join('->')}`);
            }
            // if (transaction.transactionId === atom.createdInTransaction) {
            // return false;
            // }
        }
        return true;
    }
}

const trxManager = new TransactionManager();

const updateList = { list: [] as AtomValue[], pos: 0 };

export function run() {
    if (trxManager.current.atom !== undefined || trxManager.digestRunning) return;
    trxManager.digestRunning = true;
    for (let i = 0; i < updateList.pos; i++) {
        const atom = updateList.list[i];
        actualize(atom);
        updateList.list[i] = undefined!;
    }
    updateList.pos = 0;
    trxManager.digestRunning = false;
}
function actualize(atom: Atom) {
    // console.log('actualize', atom.name, atom.value);
    if (atom.slaves !== void 0) {
        loop: for (let i = 0; i < atom.slaves.length; i++) {
            const child = atom.slaves[i];
            if (child.state === AtomState.ACTUAL) continue;
            for (let j = 0; j < child.masters.length; j += 2) {
                const master = child.masters[j] as Atom;
                // console.log('master', master);
                if (master === child) continue;
                if (master.state === AtomState.MAYBE_DIRTY || master.state === AtomState.DIRTY) {
                    continue loop;
                }
            }
            // if we have last one maybe dirty parent
            if (calcIfNeeded(child)) {
                actualize(child);
                i = -1; // cause atom.slaves can be mutated by removing child from atom
            }
        }
    }
}

function setChildrenMaybeDirtyState(atom: Atom) {
    if (atom.slaves !== void 0) {
        for (let i = 0; i < atom.slaves.length; i++) {
            const child = atom.slaves[i];
            if (child.state === AtomState.ACTUAL) {
                child.state = AtomState.MAYBE_DIRTY;
                setChildrenMaybeDirtyState(child);
            }
        }
    }
}

function removeChild(atom: Atom, child: Atom) {
    if (atom.slaves !== void 0) {
        for (let i = 0; i < atom.slaves.length; i++) {
            if (child === atom.slaves[i]) {
                atom.slaves.splice(i, 1);
                return;
            }
        }
    }
}

function addChild(atom: Atom, atomChild: AtomCalc) {
    if (atom.slaves === void 0) {
        atom.slaves = [];
    }
    for (let i = 0; i < atom.slaves.length; i++) {
        const child = atom.slaves[i];
        if (atomChild === child) {
            return i;
        }
    }
    atom.slaves.push(atomChild);
    return -1;
}

function addParent(atom: AtomCalc, atomParent: Atom) {
    for (let i = 0; i < atom.masters.length; i += 2) {
        const parent = atom.masters[i];
        if (parent === atomParent) {
            return i;
        }
    }
    atom.masters.push(atomParent, atomParent.value);
    return -1;
}

function processMaster(atom: Atom) {
    const { current } = trxManager;
    if (current.atom !== void 0) {
        // if (!trxManager.possibleToUseAtomAsSlave(this)) {
        //     return;
        // }
        const foundPos = addParent(current.atom, atom);
        if (foundPos === -1) {
            addChild(atom, current.atom);
        } else {
            current.changes[foundPos] = current.transactionId;
        }
    }
}

function calc(atom: AtomCalc) {
    trxManager.start(atom);
    // console.log('precalc', atom.name, atom.value);
    try {
        const newValue = atom.calcFun.call(atom.owner);
        const hasChanged = newValue !== atom.value;
        processTransaction(atom);
        atom.state = AtomState.ACTUAL;
        atom.value = newValue;
        return hasChanged;
    } finally {
        trxManager.end();
        // console.log('postcalc', atom.name, atom.value);
    }
}

function calcIfNeeded(atom: Atom) {
    // console.log('calcIfNeeded', atom.name, atom.state, atom.value);
    if (atom.state === AtomState.ACTUAL) return false;
    if (atom.masters === void 0 || atom.state === AtomState.DIRTY) {
        atom.masters = [];
        return calc(atom);
    }
    // Maybe dirty
    for (let i = 0; i < atom.masters.length; i += 2) {
        const parent = atom.masters[i] as Atom;
        const value = atom.masters[i + 1];
        let needToCalc = parent.value !== value;
        if (!needToCalc) {
            if (calcIfNeeded(parent)) {
                setChildrenMaybeDirtyState(parent);
                needToCalc = true;
            }
        }
        if (needToCalc && calc(atom)) {
            return true;
        }
    }
    atom.state = AtomState.ACTUAL;
    return false;
}

function processTransaction(atom: AtomCalc) {
    let shift = 0;
    for (let i = 0; i < trxManager.current.changesLength; i += 2) {
        if (trxManager.current.changes[i] !== trxManager.current.transactionId) {
            const parent = atom.masters[i - shift] as Atom;
            removeChild(parent, atom);
            atom.masters.splice(i - shift, 2);
            shift += 2;
        }
    }
}

function detachCalc(atom: AtomCalc) {
    for (let i = 0; i < atom.masters.length; i += 2) {
        const master = atom.masters[i] as Atom;
        if (master.slaves!.length === 1) {
            master.slaves = undefined;
            if (master instanceof AtomCalc) {
                detachCalc(master);
            }
        } else {
            removeChild(master, atom);
        }
    }
    atom.state = AtomState.MAYBE_DIRTY;
    atom.masters = undefined!;
}

export function autorun<T>(calcFun: () => T) {
    const atom = new AtomCalc<T>(undefined, calcFun, 'autorun');
    atom.get();
    return atom;
}

function getCalc<T>(atom: AtomCalc<T>) {
    if (calcIfNeeded(atom)) {
        setChildrenMaybeDirtyState(atom);
    }
    processMaster(atom);
    return atom.value;
}

function setValue(atom: AtomValue, value: {}) {
    atom.value = value;
    updateList.list[updateList.pos++] = atom;
    setChildrenMaybeDirtyState(atom);
}

export type Atom<T = {}> = AtomCalc<T> | AtomValue<T>;

export class AtomCalc<T = {}> {
    slaves?: AtomCalc[] = void 0;
    masters: (Atom | {})[] = undefined!;
    owner: {} | undefined;
    calcFun: () => T;
    value: T = undefined!;
    state = AtomState.DIRTY;

    constructor(owner: {} | undefined, calcFun: () => T, public name: string) {
        this.owner = owner;
        this.calcFun = calcFun;
    }

    detach() {
        detachCalc(this);
    }

    get(): T {
        return getCalc<T>(this);
    }

    reset() {
        this.state = AtomState.DIRTY;
        setChildrenMaybeDirtyState(this);
    }

    toJSON() {
        return toJSON(this.value);
    }
}

export class AtomValue<T = {}> {
    slaves?: AtomCalc[] = void 0;
    value: T;
    // createdInTransaction = trxManager.current.transactionId;
    state!: AtomState.ACTUAL;

    constructor(value: T, public name: string) {
        this.value = value;
    }

    set(value: T) {
        if (value !== this.value) {
            setValue(this, value);
            return true;
        }
        return false;
    }

    get() {
        processMaster(this);
        return this.value;
    }

    toJSON() {
        return toJSON(this.value);
    }
}
AtomValue.prototype.state = AtomState.ACTUAL;
