import { Base } from './Entity';
import { RootStore } from './RootStore';

/** @internal */
export class TreeMeta<T = {}> {
    parent: TreeMeta | undefined = undefined;
    json: {} | undefined = undefined;
    atoms: { [key: string]: {} } = {};
}
/** @internal */
export function clearParentsJson(treeMeta: TreeMeta) {
    let t: TreeMeta | undefined = treeMeta;
    while (t !== undefined && t.json !== undefined) {
        t.json = undefined;
        t = t.parent;
    }
}
/** @internal */
export function getRootStore(treeMeta: TreeMeta): RootStore | undefined {
    let t: TreeMeta | undefined = treeMeta;
    while (t !== undefined) {
        if (!(t instanceof TreeMeta)) {
            return t;
        }
        t = t.parent;
    }
    return;
}
/** @internal */
export function getRootStoreOrThrow(treeMeta: TreeMeta): RootStore {
    const rootStore = getRootStore(treeMeta);
    if (rootStore === undefined) {
        throw new Error('Object is not in the tree');
    }
    return rootStore;
}
/** @internal */
export function attachObject(current: {}, value: {}, prevValue: {} | undefined) {
    const valueTreeMeta = getObjTreeMeta(value);
    if (value === prevValue) return;
    if (prevValue !== undefined) {
        detachObject(prevValue);
    }
    if (valueTreeMeta !== undefined) {
        const treeMeta = (current as Base)._treeMeta;
        if (valueTreeMeta.parent !== undefined) {
            throw new Error('You cannot reassign value to the tree, first you need to detach your current assignment');
        }
        valueTreeMeta.parent = treeMeta;
        const rootStore = getRootStore(treeMeta);
        if (rootStore !== undefined) {
            rootStore.instances.add(value as Base);
        }
    }
}
/** @internal */
export function getObjTreeMeta<T>(obj: {} | undefined) {
    if (obj instanceof Object) {
        return (obj as Base)._treeMeta;
    }
    return;
}
/** @internal */
export function detachObject(item: {} | undefined) {
    const treeMeta = getObjTreeMeta(item);
    if (treeMeta !== undefined) {
        const rootStore = getRootStoreOrThrow(treeMeta);
        rootStore.instances.delete(item as Base);
        treeMeta.parent = undefined;
    }
}
