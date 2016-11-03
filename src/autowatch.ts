import {Atom, AtomStatus} from "./index";
class ComponentAtom extends Atom {
    protected cmp:any;

    constructor(cmp:any) {
        super();
        this.getter(cmp.constructor.name + '.render', cmp, cmp.mainRender);
        this.cmp = cmp;
    }

    protected updateCalc() {
        this.cmp.forceUpdate();
        return true;
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
            return this.componentAtom.getWithForceCalc();
        }
        else {
            return (this.componentAtom = new ComponentAtom(this)).getWithForceCalc();
        }
    }
}
