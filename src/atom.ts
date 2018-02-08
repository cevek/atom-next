export const enum AtomState {
    ACTUAL = 'ACTUAL',
    NOT_CALLED = 'NOT_CALLED',
    PARENTS_MAYBE_UPDATED = 'PARENTS_MAYBE_UPDATED',
}

let activeChildAtom: Atom;

interface Transaction {
    changes: number[];
    transactionId: number;
    changesLength: number;
}
const transactionStack = {
    stack: [] as Transaction[],
    stackLength: 0,
};
let currentTransaction: Transaction;
let transactionId = 0;

const updateList = { list: [] as Atom[], pos: 0 };

export function run() {
    for (let i = 0; i < updateList.pos; i++) {
        const atom = updateList.list[i];
        atom.actualize();
        updateList.list[i] = undefined!;
    }
    updateList.pos = 0;
}

function startTransaction(len: number) {
    if (transactionStack.stackLength === 0) {
        transactionStack.stack[transactionStack.stackLength++] = {
            changes: [],
            transactionId: 0,
            changesLength: 0,
        };
    }
    currentTransaction = transactionStack.stack[--transactionStack.stackLength];
    currentTransaction.changesLength = len;
    if (currentTransaction.changesLength > currentTransaction.changes.length) {
        currentTransaction.changes[currentTransaction.changesLength - 1] = -1;
    }
    currentTransaction.transactionId = transactionId++;
}

function endTransaction() {
    transactionStack.stack[transactionStack.stackLength++] = currentTransaction;
}

export class Atom<T = {}> {
    slaves?: Atom[] = void 0;
    masters: (Atom | {})[] = undefined!;
    calcFun?: () => T = void 0;
    value: T = undefined!;
    state: AtomState = AtomState.ACTUAL;
    name?: string;

    constructor() {}

    static value<T>(value: T, name?: string) {
        const atom = new Atom<T>();
        atom.value = value;
        atom.name = name;
        return atom;
    }

    static calc<T>(fn: () => T, name?: string) {
        const atom = new Atom<T>();
        atom.name = name;
        atom.calcFun = fn;
        atom.state = AtomState.NOT_CALLED;
        atom.masters = [];
        return atom;
    }

    static autorun(fn: () => void, name?: string) {
        const atom = Atom.calc(fn, name);
        atom.get();
        return atom;
    }

    detach() {
        for (let i = 0; i < this.masters.length; i += 2) {
            const parent = this.masters[i] as Atom;
            for (let j = 0; j < parent.slaves!.length; j++) {
                if (this === parent.slaves![j]) {
                    parent.slaves!.splice(j, 2);
                    break;
                }
            }
        }
        while (this.masters.length > 0) this.masters.pop();
    }

    set(value: T) {
        // console.log('set', value, this);
        this.value = value;
        updateList.list[updateList.pos++] = this;
        this.setChildrenMaybeState();
    }

    actualize() {
        if (this.state === AtomState.ACTUAL) return;
        this.calc(false);
        if (this.slaves !== void 0) {
            loop: for (let i = 0; i < this.slaves.length; i++) {
                const child = this.slaves[i];
                for (let i = 0; i < child.masters.length; i += 2) {
                    const master = child.masters[i] as Atom;
                    if (master === child) continue;
                    if (master.state === AtomState.PARENTS_MAYBE_UPDATED) {
                        continue loop;
                    }
                }
                child.actualize();
            }
        }
    }

    setChildrenMaybeState() {
        if (this.slaves !== void 0) {
            for (let i = 0; i < this.slaves.length; i++) {
                const child = this.slaves[i];
                if (child.state === AtomState.ACTUAL) {
                    child.state = AtomState.PARENTS_MAYBE_UPDATED;
                    child.setChildrenMaybeState();
                }
            }
        }
    }

    removeChild(child: Atom) {
        for (let i = 0; i < this.slaves!.length; i++) {
            if (child === this.slaves![i]) {
                this.slaves!.splice(i, 1);
                return;
            }
        }
    }

    processTransaction() {
        let shift = 0;
        for (let i = 0; i < currentTransaction.changesLength; i += 2) {
            if (currentTransaction.changes[i] !== currentTransaction.transactionId) {
                const parent = this.masters[i - shift] as Atom;
                parent.removeChild(this);
                this.masters.splice(i - shift, 2);
                shift += 2;
            }
        }
    }

    calc(setChildrenMaybeState: boolean) {
        let prevActiveAtom = activeChildAtom;
        activeChildAtom = this;
        startTransaction(this.masters.length);
        console.log('precalc', this.name, this.value);
        try {
            const newValue = this.calcFun!();
            const hasChanged = newValue !== this.value;
            if (hasChanged && setChildrenMaybeState) {
                this.setChildrenMaybeState();
            }
            this.processTransaction();
            this.state = AtomState.ACTUAL;
            this.value = newValue;
            return hasChanged;
        } finally {
            endTransaction();
            activeChildAtom = prevActiveAtom;
            console.log('postcalc', this.name, this.value);
        }
    }

    calcIfNeeded() {
        console.log('calcIfNeeded', this.name, this.state, this.value);
        if (this.state === AtomState.PARENTS_MAYBE_UPDATED) {
            for (let i = 0; i < this.masters.length; i += 2) {
                const parent = this.masters[i] as Atom;
                const value = this.masters[i + 1];
                if (parent.value !== value || parent.calcIfNeeded()) {
                    if (this.calc(true)) {
                        return true;
                    }
                }
            }
            this.state = AtomState.ACTUAL;
        } else if (this.state === AtomState.NOT_CALLED) {
            return this.calc(true);
        }
        return false;
    }

    addChild(atom: Atom) {
        if (this.slaves === void 0) {
            this.slaves = [];
        }
        for (let i = 0; i < this.slaves.length; i++) {
            const child = this.slaves[i];
            if (atom === child) {
                return i;
            }
        }
        this.slaves.push(atom);
        return -1;
    }

    addParent(atom: Atom) {
        for (let i = 0; i < this.masters.length; i += 2) {
            const parent = this.masters[i];
            if (parent === atom) {
                return i;
            }
        }
        this.masters.push(atom, atom.value);
        return -1;
    }

    processMaster() {
        if (activeChildAtom !== void 0) {
            const foundPos = activeChildAtom.addParent(this);
            if (foundPos === -1) {
                this.addChild(activeChildAtom);
            } else {
                currentTransaction.changes[foundPos] = currentTransaction.transactionId;
            }
        }
    }

    get() {
        this.calcIfNeeded();
        this.processMaster();
        return this.value;
    }
}
