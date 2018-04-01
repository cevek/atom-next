import { attachObject, clearParentsJson, getRootStore, TreeMeta } from './TreeMeta';
import { ClassMeta, getTransformValue, setTransformValue } from './ClassMeta';
import { createField, Field } from './Field';
import { KeyedAtomCalc } from './KeyedAtomCalc';
import { Atom, AtomCalc, AtomValue } from './Atom';
import { checkWeAreInAction } from './Utils';
import { Base } from './Entity';
import { addField, buildElementClassMeta } from './EntityUtils';
import { DepsFix } from './DepsFix';

/** @internal */
export function prop(targetProto: Base, prop: string) {
    const field = createField(prop, undefined);
    setProp(targetProto.constructor as typeof Base, field);
}

/** @internal */
export function calc(targetProto: Base, prop: string) {
    const method = Object.getOwnPropertyDescriptor(targetProto, prop)!.get;
    if (method === undefined) {
        throw new Error('prop is not a getter');
    }
    setCalcProp(targetProto.constructor as typeof Base, prop, method);
}

// noinspection JSUnusedLocalSymbols
export function get<Prop extends string, Host extends Base & Record<Prop, (key: {}) => {} | undefined>>(
    target: Host,
    prop: Prop
): any;
// noinspection JSUnusedLocalSymbols
export function get<Prop extends string, Host extends Base & Record<Prop, (key: {}) => {} | undefined>>(
    target: Host,
    prop: Prop
): any;
export function get(targetProto: Base, prop: string) {
    const fn = targetProto[prop];
    Object.defineProperty(targetProto, prop, {
        value: function(this: Base, key: {}) {
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

/** @internal */
export function setProp(Class: typeof Base, field: Field) {
    if (field.skipped) return;
    // field.added = true;
    const prop = field.name;
    Object.defineProperty(Class.prototype, prop, {
        enumerable: true,
        get: function(this: Base) {
            const treeMeta = this._treeMeta;
            let atom = treeMeta.atoms[prop] as AtomValue;
            if (atom === undefined) {
                atom = new AtomValue<{}>(undefined!, Class.name + '.' + prop);
                treeMeta.atoms[prop] = atom;
            }
            return getTransformValue(getRootStore(treeMeta), field, atom.get());
        },
        set: function(this: Base, value: {}) {
            const treeMeta = this._treeMeta;
            let atom = treeMeta.atoms[prop] as AtomValue | undefined;
            const prevValue = atom === undefined ? undefined : atom!.value;
            value = setTransformValue(getRootStore(treeMeta), field, value, prevValue);
            if (atom === undefined) {
                atom = new AtomValue(value, Class.name + '.' + prop);
                treeMeta.atoms[prop] = atom;
            } else {
                if (atom.set(value)) {
                    checkWeAreInAction();
                }
            }
            if (value !== prevValue) {
                attachObject(this, value, prevValue);
                clearParentsJson(treeMeta);
            }
        },
    });
}

/** @internal */
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

export function hash<T>(Cls: typeof Base | ClassMeta | undefined) {
    return function<Prop extends string, Trg extends Base /* & Record<Prop, Map<number | string, T> | undefined>*/>(
        targetProto: Trg,
        prop: Prop
    ) {
        addField(targetProto, prop, hashType(Cls));
    };
}

export function hashType<T>(Class?: typeof Base | ClassMeta) {
    const elementClassMeta = buildElementClassMeta(Class);
    return new ClassMeta({
        setTransformer: (rootStore, json, prev) => DepsFix.HashMap.factory(elementClassMeta, json, prev as undefined),
    });
}


export function array<T>(Cls: typeof Base | ClassMeta) {
    return function<Prop extends string, Trg extends Base & Record<Prop, T[] | undefined>>(
        targetProto: Trg,
        prop: Prop
    ) {
        addField(targetProto, prop, arrayType(Cls));
    };
}

export function arrayType(Class?: typeof Base | ClassMeta) {
    const elementClassMeta = buildElementClassMeta(Class);
    return new ClassMeta({
        setTransformer: (rootStore, json, prev) =>
            DepsFix.ArrayProxy.factory(elementClassMeta, json as {}[], prev as undefined),
    });
}
