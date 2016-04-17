const promise = (window as any).Promise.resolve();
function runMicroTask(callback:()=>void){
    promise.then(callback);
}


export const enum AtomStatus {
    PROP = 1,
    GETTER_NO_VAL = 2,
    GETTER = 3,
    DESTROYED = -1,
}

export const enum AtomAffectStatus{
    NEEDCALC = 1,
    CALC = 5,
    NEEDNOT_CALC = 10,
    WAIT_PARENT_CALC = 30,
}

export const enum TaskType {
    CHANGE = 10,
    CLEAR_MASTERS = 20,
    MASTERS = 30,
    DESTROY = 50,
}

export interface IDMap<T> {
    [id:number]:T;
}

export class TaskList {
    pos = 0;
    donePos = 0;
    asyncRunned = false;
    queue:any[];
    size = 30000;

    get list() {
        const items:any = [];
        for (var i = this.donePos; i < this.pos; i += 3) {
            const pos = i % this.size;
            const type:TaskType = this.queue[pos];
            items.push({type: type, atom: this.queue[pos + 1], slave: this.queue[pos + 2]});
        }
        return items;
    }

    constructor(public taskRunner:()=>void) {
        this.queue = new Array(this.size);
    }

    addTask(taskType:TaskType, atom:Atom, slave?:Atom) {
        if (!this.asyncRunned) {
            this.asyncRunned = true;
            runMicroTask(this.taskRunner);
        }
        const pos = this.pos % this.size;
        this.queue[pos] = taskType;
        this.queue[pos + 1] = atom;
        if (slave) {
            this.queue[pos + 2] = slave;
        }
        this.pos += 3;
    }

    iterateUndone(callback:(type:TaskType, atom:Atom, slave:Atom, isLast:boolean)=>void) {
        if (this.pos - this.donePos > this.size) {
            throw new Error('Out of range');
        }
        for (var i = this.donePos; i < this.pos; i += 3) {
            const pos = i % this.size;
            const type:TaskType = this.queue[pos];
            callback(type, this.queue[pos + 1], type == TaskType.MASTERS ? this.queue[pos + 2] : null, i == this.pos - 3);
            this.donePos += 3;
        }
        this.asyncRunned = false;
    }
}

export class Atom {
    protected id = ++Atom.atomId;
    protected slaves:IDMap<Atom>;
    protected masters:IDMap<Atom>;
    protected status:AtomStatus;
    protected field:string;
    protected value:any;
    protected owner:any;
    protected calcFn:()=>void;
    protected static activeSlave: Atom;
    protected static lastGetted: Atom;
    protected static autoMasters = true;
    protected static atomId = 0;
    protected static debugAtoms:{[id:string]:boolean} = null;
    static debugAtom(name:string) {
        if (!Atom.debugAtoms) {
            Atom.debugAtoms = {};
        }
        Atom.debugAtoms[name] = true;
    }

    protected static debug(){
        debugger;
    }

    prop(field:string, value:any) {
        this.value = value;
        this.field = field;
        this.slaves = null;
        this.status = AtomStatus.PROP;
        return this;
    }

    getter(field:string, owner:any, calcFn:()=>void) {
        this.value = null;
        this.field = field;
        this.slaves = null;
        this.calcFn = calcFn;
        this.owner = owner;
        this.masters = null;
        this.status = AtomStatus.GETTER_NO_VAL;
        return this;
    }

    get() {
        this.checkForDestroy();
        Atom.lastGetted = this;
        if (Atom.activeSlave && Atom.autoMasters) {
            Atom.scheduledTasks.addTask(TaskType.MASTERS, this, Atom.activeSlave);
        }
        if (this.status == AtomStatus.GETTER_NO_VAL) {
            this.calc();
        }
        return this.value;
    }

    set(value:any) {
        this.checkForDestroy();
        if (this.value !== value) {
            this.value = value;
            this.change();
        }
    }

    change() {
        this.checkForDestroy();
        Atom.scheduledTasks.addTask(TaskType.CHANGE, this);
    }

    destroy() {
        this.checkForDestroy();
        if (Atom.debugAtoms && (Atom.debugAtoms[this.field] || Atom.debugAtoms[this.id])) {
            Atom.debug();
        }
        this.status = AtomStatus.DESTROYED;
        Atom.scheduledTasks.addTask(TaskType.DESTROY, this);
    }

    protected realDestroy() {
        this.clearMasters();
        this.clearSlaves();
        // this.value = null;
        this.owner = null;
        this.calcFn = null;
    }

    static getAtom(callback:()=>void, thisArg?:any) {
        const oldAutoMasters = Atom.autoMasters;
        const oldLastGetted = Atom.lastGetted;
        Atom.autoMasters = false;
        Atom.lastGetted = null;
        callback.call(thisArg);
        if (!Atom.lastGetted) {
            throw new Error('Atom not found');
        }
        const atom = Atom.lastGetted;
        Atom.lastGetted = oldLastGetted;
        Atom.autoMasters = oldAutoMasters;
        return atom;
    }

    protected setSelfToActiveSlave(slave:Atom) {
        this.checkForDestroy();
        if (!slave.masters) {
            slave.masters = {};
        }
        slave.masters[this.id] = this;
        if (!this.slaves) {
            this.slaves = {};
        }
        this.slaves[slave.id] = slave;
    }

    protected checkForDestroy() {
        if (this.status == AtomStatus.DESTROYED) {
            throw new Error('Try to use destroyed atom');
        }
    }

    protected calc() {
        this.checkForDestroy();
        const oldActiveSlave = Atom.activeSlave;
        Atom.scheduledTasks.addTask(TaskType.CLEAR_MASTERS, this);
        Atom.activeSlave = this;
        const oldValue = this.value;
        if (Atom.debugAtoms && (Atom.debugAtoms[this.field] || Atom.debugAtoms[this.id])) {
            Atom.debug();
        }
        this.value = this.calcFn.call(this.owner);
        Atom.activeSlave = oldActiveSlave;
        this.status = AtomStatus.GETTER;
        // console.info(this.field, this.id);
        return oldValue !== this.value;
    }

    protected clearMasters() {
        if (this.masters) {
            for (const id in this.masters) {
                const master = this.masters[id];
                if (master) {
                    master.slaves[this.id] = null;
                }
                // this.masters[id] = null;
            }
            this.masters = null;
        }
    }

    protected clearSlaves() {
        if (this.slaves) {
            for (const id in this.slaves) {
                const slave = this.slaves[id];
                if (slave) {
                    slave.masters[this.id] = null;
                }
            }
            this.slaves = null;
        }
    }


    protected affect(affectAtoms:IDMap<AtomAffectStatus>) {
        affectAtoms[this.id] = 1;
        if (this.slaves) {
            for (const id in this.slaves) {
                const slave = this.slaves[id];
                if (slave) {
                    slave.affect(affectAtoms);
                }
            }
        }
    }

    protected needToRecalc(affectAtoms:IDMap<AtomAffectStatus>) {
        if (this.status == AtomStatus.DESTROYED) {
            return AtomAffectStatus.NEEDNOT_CALC;
        }
        let status = AtomAffectStatus.NEEDNOT_CALC;
        if (this.masters) {
            for (const id in this.masters) {
                if (this.masters[id]) {
                    const masterAffectStatus = affectAtoms[id];
                    if (masterAffectStatus === AtomAffectStatus.NEEDCALC) {
                        return AtomAffectStatus.WAIT_PARENT_CALC;
                    }
                    if (masterAffectStatus === AtomAffectStatus.CALC) {
                        status = AtomAffectStatus.CALC;
                    }
                }
            }
        }
        return status;
    }

    protected update(topLevel:boolean, affectAtoms:IDMap<AtomAffectStatus>) {
        if (affectAtoms[this.id] !== AtomAffectStatus.NEEDCALC) {
            throw new Error('Something wrong');
        }
        const status = topLevel ? AtomAffectStatus.CALC : this.needToRecalc(affectAtoms);
        if (status === AtomAffectStatus.WAIT_PARENT_CALC) {
            return;
        }
        if (status === AtomAffectStatus.CALC && this.status === AtomStatus.GETTER) {
            this.calc();
        }
        affectAtoms[this.id] = status;
        if (this.slaves) {
            for (const id in this.slaves) {
                const slave = this.slaves[id];
                if (slave) {
                    slave.update(false, affectAtoms);
                }
            }
        }
    }

    protected static batchUpdate(changeAtoms:IDMap<Atom>) {
        // Atom.affectAtoms = {};
        const affectAtoms:IDMap<AtomAffectStatus> = {}
        for (const id in changeAtoms) {
            var atom = changeAtoms[id];
            atom.affect(affectAtoms);
        }
        for (const id in changeAtoms) {
            var atom = changeAtoms[id];
            atom.update(true, affectAtoms);
        }
    }

    protected static scheduledTasks = new TaskList(Atom.updateScheduled);

    protected static updateScheduled() {
        console.log("start schedule runner");
        let changeAtoms:IDMap<Atom> = {};
        let prevType:TaskType = null;

        Atom.scheduledTasks.iterateUndone((type:TaskType, atom:Atom, slave:Atom, isLast:boolean) => {
            if (type == TaskType.CHANGE) {
                changeAtoms[atom.id] = atom;
                if (isLast) {
                    Atom.batchUpdate(changeAtoms);
                    changeAtoms = {};
                }
            } else if (prevType == TaskType.CHANGE) {
                Atom.batchUpdate(changeAtoms);
                changeAtoms = {};
            }
            else if (type == TaskType.CLEAR_MASTERS) {
                atom.clearMasters();
            }
            else if (type == TaskType.MASTERS) {
                atom.setSelfToActiveSlave(slave);
            }
            else if (type == TaskType.DESTROY) {
                atom.realDestroy();
            }
            prevType = type;
        });
    }
}

(window as any).AtomGlob = Atom;
(window as any).debugAtom = Atom.debugAtom;
