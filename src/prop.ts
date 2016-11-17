import {Atom} from "./index";
(window as any).AtomGlob = Atom;

const atomPrefix = '_';
export function getAtomFieldName(prop: string) {
    return atomPrefix + prop;
}
export var prop: any = function (proto: any, prop: string, descriptor?: PropertyDescriptor) {
    var _prop = getAtomFieldName(prop);
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
                return atom.getWithCalc();
            }
            else {
                atom = this.${_prop} = new AtomGlob().getter('${fieldName}', this, this.${_prop}Getter);
                return atom.getWithCalc();
            }
            `);
        return {
            enumerable: true,
            set: void 0,
            get: getterFn
        }
    }
    return {
        enumerable: true,
        set: setFn,
        get: getFn
    }
};
/*
 const orig = Object.getOwnPropertyDescriptor;
 Object.getOwnPropertyDescriptor = function (obj:any, prop:string) {
 var result = orig.apply(this, arguments);
 if (obj && obj['_' + prop] instanceof Atom) {
 return {
 configurable: true,
 enumerable: true,
 value: obj['_' + prop].value
 }
 }
 if (result.get && result.get.AtomGetter) {
 delete result.get;
 delete result.set;
 result.value = null;
 }
 return result;
 }

 const ObjectKeys = Object.keys;
 Object.keys = function (obj:any) {
 var result = ObjectKeys.apply(this, arguments);
 for (var i = 0; i < result.length; i++) {
 var prop = result[i];
 if (prop[0] == '_' && prop instanceof Atom) {
 result.splice(i, 1);
 // result.push(prop.substr(1));
 }
 }
 return [];
 }*/

const HostObjectKeys = Object.keys;
const ObjectKeys = function (obj: any) {
    const result = HostObjectKeys.apply(this, arguments);
    const newResult: string[] = [];
    for (let i = 0; i < result.length; i++) {
        const prop = result[i];
        if (prop.substr(0, atomPrefix.length) == atomPrefix) {
            newResult.push(prop.substr(atomPrefix.length));
        } else {
            newResult.push(prop);
        }
    }
    return newResult;
}

const HostObjectGetOwnPropertyNames = Object.getOwnPropertyNames;
const ObjectGetOwnPropertyNames = function (obj: any) {
    const result = HostObjectGetOwnPropertyNames.apply(this, arguments);
    const newResult: string[] = [];
    for (let i = 0; i < result.length; i++) {
        const prop = result[i];
        if (prop.substr(0, atomPrefix.length) == atomPrefix) {
            newResult.push(prop.substr(atomPrefix.length));
        } else {
            newResult.push(prop);
        }
    }
    return newResult;
}

if (typeof localStorage == 'object' && localStorage.getItem('atom_pretty')) {
    Object.getOwnPropertyNames = ObjectGetOwnPropertyNames;
    Object.keys = ObjectKeys;
}
