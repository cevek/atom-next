import {Atom, TaskType, IDMap, AtomAffectStatus, AtomStatus} from "./index";
class ComponentAtom extends Atom {
    protected cmp:any;

    constructor(cmp:any) {
        super();
        this.getter(cmp.constructor.name + '.render', cmp, cmp.mainRender);
        this.cmp = cmp;
    }

    get() {
        this.checkForDestroy();
        if (Atom.activeSlave && Atom.autoMasters) {
            Atom.scheduledTasks.addTask(TaskType.MASTERS, this, Atom.activeSlave);
        }
        this.calc();
        return this.value;
    }

    protected update(topLevel:boolean, affectAtoms:IDMap<AtomAffectStatus>) {
        if (affectAtoms[this.id] !== AtomAffectStatus.NEEDCALC) {
            throw new Error('Something wrong');
        }
        const status = topLevel ? AtomAffectStatus.CALC : this.needToRecalc(affectAtoms);
        if (status === AtomAffectStatus.WAIT_PARENT_CALC) {
            return;
        }
        if (Atom.debugAtoms && (Atom.debugAtoms[this.field] || Atom.debugAtoms[this.id])) {
            Atom.debug();
        }
        if (status === AtomAffectStatus.CALC && this.status === AtomStatus.GETTER) {
            this.cmp.forceUpdate();
        }
        affectAtoms[this.id] = status;
    }
}

export const autowatch = function (cls:any) {
    cls.prototype.componentAtom = null;
    cls.prototype.mainRender = cls.prototype.render;
    cls.prototype.shouldComponentUpdate = function (nextProps:any) {
        for (const prop in nextProps) {
            if (this.props[prop] !== nextProps[prop]) {
                return true;
            }
        }
        for (const prop in this.props) {
            if (this.props[prop] !== nextProps[prop]) {
                return true;
            }
        }
        return false;
    }
    cls.prototype.componentWillUnmount = function () {
        this.componentAtom.destroy();
    }
    cls.prototype.render = function () {
        if (this.componentAtom) {
            return this.componentAtom.get();
        }
        else {
            return (this.componentAtom = new ComponentAtom(this)).get();
        }
    }
}
