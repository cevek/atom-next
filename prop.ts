export var prop:any = function (proto:any, prop:string, descriptor?:PropertyDescriptor) {
    var _prop = ('_' + prop).substr(0);
    const fieldName = proto.constructor.name + '.' + prop;

    const getFn = new Function(`
            var atom = this.${_prop};
            if (atom) {
                return atom.get();
            }
            else {
                atom = this.${_prop} = new AtomGlob().prop('${fieldName}', null);
                return atom.get();
            }
            `);
    const setFn = new Function('value', `
            var atom = this.${_prop};
            if (atom) {
                atom.set(value);
            }
            else {
                this.${_prop} = new AtomGlob().prop('${fieldName}', value);
            }
            `);
    if (descriptor && descriptor.get) {
        proto[_prop + 'Getter'] = descriptor.get;
        const getterFn = new Function(`
            var atom = this.${_prop};
            if (atom) {
                return atom.get();
            }
            else {
                atom = this.${_prop} = new AtomGlob().getter('${fieldName}', this, this.${_prop}Getter);
                return atom.get();
            }
            `);
        return {
            set: void 0,
            get: getterFn
        }
    }
    return {
        set: setFn,
        get: getFn
    }
};
