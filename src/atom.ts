export const enum AtomState {
    ACTUAL = 'ACTUAL',
    MAYBE_DIRTY = 'MAYBE_DIRTY',
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
    for (let i = 0; i < updateList.pos; i++) {
        const atom = updateList.list[i];
        actualize(atom);
        updateList.list[i] = undefined!;
    }
    updateList.pos = 0;
}
/*
export class Atom<T = {}> {
    slaves?: Atom[] = void 0;
    masters: (Atom | {})[] = undefined!;
    calcFun?: () => T = void 0;
    value: T = undefined!;
    state: AtomState = AtomState.ACTUAL;
    name?: string;
    createdInTransaction = trxManager.current.transactionId;

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
        atom.state = AtomState.MAYBE_DIRTY;
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
        console.log('actualize', this.name, this.state, this.value);
        if (this.state === AtomState.MAYBE_DIRTY) {
            this.calc(false);
        }
        if (this.slaves !== void 0) {
            loop: for (let i = 0; i < this.slaves.length; i++) {
                const child = this.slaves[i];
                for (let i = 0; i < child.masters.length; i += 2) {
                    const master = child.masters[i] as Atom;
                    // console.log('master', master);
                    if (master === child) continue;
                    if (master.state === AtomState.MAYBE_DIRTY) {
                        continue loop;
                    }
                }
                if (child.state !== AtomState.ACTUAL) {
                    child.actualize();
                }
            }
        }
    }

    setChildrenMaybeState() {
        if (this.slaves !== void 0) {
            for (let i = 0; i < this.slaves.length; i++) {
                const child = this.slaves[i];
                if (child.state === AtomState.ACTUAL) {
                    child.state = AtomState.MAYBE_DIRTY;
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
        for (let i = 0; i < trxManager.current.changesLength; i += 2) {
            if (trxManager.current.changes[i] !== trxManager.current.transactionId) {
                const parent = this.masters[i - shift] as Atom;
                parent.removeChild(this);
                this.masters.splice(i - shift, 2);
                shift += 2;
            }
        }
    }

    calc(setChildrenMaybeState: boolean) {
        trxManager.start(this);
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
            trxManager.end();
            console.log('postcalc', this.name, this.value);
        }
    }

    calcIfNeeded() {
        console.log('calcIfNeeded', this.name, this.state, this.value);
        if (this.state === AtomState.MAYBE_DIRTY) {
            if (this.masters === void 0) {
                this.masters = [];
                return this.calc(true);
            }
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
        const { current } = trxManager;
        if (current.atom !== void 0) {
            // if (!trxManager.possibleToUseAtomAsSlave(this)) {
            //     return;
            // }
            const foundPos = current.atom.addParent(this);
            if (foundPos === -1) {
                this.addChild(current.atom);
            } else {
                current.changes[foundPos] = current.transactionId;
            }
        }
    }

    get() {
        this.calcIfNeeded();
        this.processMaster();
        return this.value;
    }
}
*/

function actualize(atom: Atom) {
    console.log('actualize', atom.name, atom.value);
    if (atom.slaves !== void 0) {
        loop: for (let i = 0; i < atom.slaves.length; i++) {
            const child = atom.slaves[i];
            for (let i = 0; i < child.masters.length; i += 2) {
                const master = child.masters[i] as Atom;
                // console.log('master', master);
                if (master === child) continue;
                if (master.state === AtomState.MAYBE_DIRTY) {
                    continue loop;
                }
            }
            if (child.state === AtomState.MAYBE_DIRTY) {
                calc(child, false);
                actualize(child);
            }
        }
    }
}

function setChildrenMaybeState(atom: Atom) {
    if (atom.slaves !== void 0) {
        for (let i = 0; i < atom.slaves.length; i++) {
            const child = atom.slaves[i];
            if (child.state === AtomState.ACTUAL) {
                child.state = AtomState.MAYBE_DIRTY;
                setChildrenMaybeState(child);
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

function calc(atom: AtomCalc, setChildrenMaybeState1: boolean) {
    trxManager.start(atom);
    console.log('precalc', atom.name, atom.value);
    try {
        const newValue = atom.calcFun();
        const hasChanged = newValue !== atom.value;
        if (hasChanged && setChildrenMaybeState1) {
            setChildrenMaybeState(atom);
        }
        processTransaction(atom);
        atom.state = AtomState.ACTUAL;
        atom.value = newValue;
        return hasChanged;
    } finally {
        trxManager.end();
        console.log('postcalc', atom.name, atom.value);
    }
}

function calcIfNeeded(atom: AtomCalc) {
    console.log('calcIfNeeded', atom.name, atom.state, atom.value);
    if (atom.masters === void 0) {
        atom.masters = [];
        return calc(atom, true);
    }
    for (let i = 0; i < atom.masters.length; i += 2) {
        const parent = atom.masters[i] as Atom;
        const value = atom.masters[i + 1];
        if (parent.value !== value || (parent.state === AtomState.MAYBE_DIRTY && calcIfNeeded(parent))) {
            if (calc(atom, true)) {
                return true;
            }
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

export type Atom = AtomCalc | AtomValue;

export class AtomCalc<T = {}> {
    slaves?: AtomCalc[] = void 0;
    masters: (Atom | {})[] = undefined!;
    calcFun: () => T;
    value: T = undefined!;
    state = AtomState.MAYBE_DIRTY;

    constructor(calcFun: () => T, public name?: string) {
        this.calcFun = calcFun;
    }

    static autorun<T>(calcFun: () => T, name?: string) {
        const atom = new AtomCalc<T>(calcFun, name);
        atom.get();
        return atom;
    }

    detach() {
        for (let i = 0; i < this.masters.length; i += 2) {
            const parent = this.masters[i] as Atom;
            if (parent.slaves !== void 0) {
                for (let j = 0; j < parent.slaves.length; j++) {
                    if (this === parent.slaves[j]) {
                        parent.slaves.splice(j, 2);
                        break;
                    }
                }
            }
        }
        while (this.masters.length > 0) this.masters.pop();
    }

    get() {
        if (this.state === AtomState.MAYBE_DIRTY) {
            calcIfNeeded(this);
        }
        processMaster(this);
        return this.value;
    }
}

export class AtomValue<T = {}> {
    slaves?: AtomCalc[] = void 0;
    value: T;
    // createdInTransaction = trxManager.current.transactionId;
    state: AtomState.ACTUAL;

    constructor(value: T, public name?: string) {
        this.value = value;
    }

    set(value: T) {
        this.value = value;
        updateList.list[updateList.pos++] = this;
        setChildrenMaybeState(this);
    }

    get() {
        processMaster(this);
        return this.value;
    }
}
AtomValue.prototype.state = AtomState.ACTUAL;
