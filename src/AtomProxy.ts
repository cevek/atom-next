import { AtomValue, Factory, glob, initValueIfNeeded, RootStore, Target } from './AtomTree';

export class AtomProxy {
    constructor() {
        this._rootStore = glob.globRootStore;
        this._parent = glob.globParent;
        this._target = {};
        this._values = Array(this._fields.length);
        if (glob.globRootStore !== void 0) {
            glob.globRootStore._makePathAndAddToStorage(this, glob.globKey!);
        }
    }

    _id = glob.id++;
    _path: string = '';
    _parent: AtomProxy | undefined = void 0;
    _target: Target = {};
    _rootStore: RootStore | undefined = void 0;
    //
    // _getRootStore() {
    //     let rootStore: RootStore | void 0 = this.__rootStore;
    //     if (rootStore === void 0) {
    //         let parent = this._parent;
    //         while (parent !== void 0 && rootStore === void 0) {
    //             rootStore = parent.__rootStore;
    //         }
    //         this.__rootStore = rootStore;
    //     }
    //     return rootStore;
    // }

    // _keyIdx: number;
    _key: string | number = '';
    _attached = true;
    _values: (AtomProxy | AtomValue | undefined)[];

    _setTarget(target: Target) {
        if (glob.inInitializing) {
            if (typeof target === 'object' && target !== null && target.constructor === Object) {
                this._target = target;
                for (let i = 0; i < this._fields.length; i++) {
                    const field = this._fields[i];
                    const value = initValueIfNeeded(this, i);
                    value._setTarget(target[field]);
                }
            }
        } else {
            throw new Error('Cannot set target');
        }
    }

    /* prototype fields */
    _fields!: string[];
    _excludedMethods!: string[];
    _factoryClasses!: (Factory | undefined)[];
}

AtomProxy.prototype._fields = [];
AtomProxy.prototype._factoryClasses = [];
AtomProxy.prototype._excludedMethods = [];