import { attachObject, clearParentsJson, getRootStoreOrThrow, TreeMeta } from './TreeMeta';
import { Base, getClassMetaOfEntity } from './Entity';
import { ClassMeta, getTransformValue, setTransformValue } from './ClassMeta';
import { createField, Field } from './Field';
import { KeyedAtomCalc } from './KeyedAtomCalc';
import { Atom, AtomCalc, AtomValue } from './Atom';
import { checkWeAreInAction } from './Utils';

export function prop(targetProto: Base, prop: string) {
    const field = createField(prop, undefined);
    setProp(targetProto.constructor as typeof Base, field);
}

export function calc(targetProto: Base, prop: string) {
    const method = Object.getOwnPropertyDescriptor(targetProto, prop)!.get;
    if (method === undefined) {
        throw new Error('prop is not a getter');
    }
    setCalcProp(targetProto.constructor as typeof Base, prop, method);
}

export function sub<T>(Class: typeof Base) {
    return function<Prop extends string, Trg extends Base & Record<Prop, T | undefined>>(targetProto: Trg, prop: Prop) {
        addField(targetProto, prop, getClassMetaOfEntity(Class));
    };
}
// noinspection JSUnusedLocalSymbols
export function key<Prop extends string, Host extends Base & Record<Prop, (key: number) => {} | undefined>>(
    target: Host,
    prop: Prop
): any;
// noinspection JSUnusedLocalSymbols
export function key<Prop extends string, Host extends Base & Record<Prop, (key: string) => {} | undefined>>(
    target: Host,
    prop: Prop
): any;
export function key(targetProto: Base, prop: string) {
    const fn = targetProto[prop];
    Object.defineProperty(targetProto, prop, {
        value: function(this: Base, key: string | number | undefined) {
            let treeMeta = this._treeMeta;
            if (treeMeta === undefined) {
                treeMeta = this._treeMeta = new TreeMeta();
            }
            let keyedAtom = treeMeta.atoms[prop] as KeyedAtomCalc;
            if (keyedAtom === undefined) {
                treeMeta.atoms[prop] = keyedAtom = new KeyedAtomCalc(this, fn);
            }
            return keyedAtom.get(key);
        },
    });
}

export function skip<T>(targetProto: Base, prop: string) {
    const field = addField(targetProto, prop, undefined);
    field.skipped = true;
}

export function ref<T>(Class: typeof Base) {
    return function<Prop extends string, Trg extends Base /* & Record<Prop, Map<number | string, T> | undefined>*/>(
        targetProto: Trg,
        prop: Prop
    ) {
        addField(
            targetProto,
            prop,
            new ClassMeta({
                setTransformer: (parent, value) => {
                    if (value instanceof Base) {
                        return value.id;
                    }
                    throw new Error('Value is not instance of the Base class');
                },
                getTransformer: (parent, value) => {
                    const rootStore = getRootStoreOrThrow(parent._treeMeta);
                    return rootStore.instances.get(Class, value as string);
                },
            })
        );
    };
}

export function buildElementClassMeta(Class: typeof Base | ClassMeta | undefined) {
    return Class instanceof ClassMeta ? Class : Class === undefined ? undefined : getClassMetaOfEntity(Class);
}
export function addField(targetProto: Base, prop: string, propClassMeta: ClassMeta | undefined) {
    const Target = targetProto.constructor as typeof Base;
    const hostClassMeta = getClassMetaOfEntity(Target);
    let field = hostClassMeta.fields.filter(field => field.name === prop).pop();
    if (field === undefined) {
        field = createField(prop, undefined);
        hostClassMeta.fields.push(field);
    }
    if (propClassMeta !== undefined) {
        field.classMeta = propClassMeta;
    }
    return field;
}

export function setProp(Class: typeof Base, field: Field) {
    if (field.skipped) return;
    // field.added = true;
    const prop = field.name;
    Object.defineProperty(Class.prototype, prop, {
        enumerable: true,
        get: function(this: Base) {
            let treeMeta = this._treeMeta;
            let atom = treeMeta.atoms[prop] as AtomValue;
            if (atom === undefined) {
                return undefined;
            }
            return getTransformValue(this, field, atom.get());
        },
        set: function(this: Base, value: {}) {
            let treeMeta = this._treeMeta;
            if (typeof treeMeta === 'undefined') {
                treeMeta = this._treeMeta = new TreeMeta();
            }
            let atom = treeMeta.atoms[prop] as AtomValue | undefined;
            const prevValue = atom === undefined ? undefined : atom!.value;
            value = setTransformValue(this, field, value, prevValue);
            if (atom === undefined) {
                atom = new AtomValue(value, Class.name + '.' + prop);
                treeMeta.atoms[prop] = atom;
            } else {
                checkWeAreInAction();
                atom.set(value);
            }
            attachObject(this, value, prevValue);
            clearParentsJson(treeMeta);
        },
    });
}

export function setCalcProp(Class: typeof Base, prop: string, method: () => {}) {
    Object.defineProperty(Class.prototype, prop, {
        get: function(this: Base) {
            let treeMeta = this._treeMeta;
            let atom = (treeMeta.atoms[prop] as Atom) as AtomCalc;
            if (typeof atom === 'undefined') {
                treeMeta.atoms[prop] = atom = new AtomCalc(this, method, Class.name + '.' + prop + '()');
            }
            return atom.get();
        },
    });
}
