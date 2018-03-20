import { This } from './Entity';
import { RootStore } from './RootStore';

export class TreeMeta<T = {}> {
    id: string | number | undefined = undefined;
    parent: TreeMeta | undefined = undefined;
    json: {} | undefined = undefined;
    atoms: { [key: string]: {} } = {};
}

export function clearParentsJson(treeMeta: TreeMeta) {
    let t: TreeMeta | undefined = treeMeta;
    while (t !== undefined && t.json !== undefined) {
        t.json = undefined;
        t = t.parent;
    }
}
export function getRootStore(treeMeta: TreeMeta): RootStore | undefined {
    let t: TreeMeta | undefined = treeMeta;
    while (t !== undefined) {
        if (t instanceof RootStore) {
            return t;
        }
        t = t.parent;
    }
    return;
}
export function getRootStoreFromObj(obj: {} | undefined): RootStore {
    if (obj instanceof Object) {
        return getRootStore((obj as This)._treeMeta)!;
    }
    return undefined!;
}

export function attach(parent: TreeMeta, treeMeta: TreeMeta) {
    if (treeMeta.parent !== undefined) {
        throw new Error('You cannot reassign value to the tree, first you need to detach your current assignment');
    }
    treeMeta.parent = parent;
    if (treeMeta.id === undefined) {
        const rootStore = getRootStore(parent);
        if (rootStore !== undefined) {
            treeMeta.id = rootStore.createId();
        }
    }
}

export function attachObject(current: {}, value: {}, prevValue: {} | undefined) {
    const valueTreeMeta = getObjTreeMeta(value);
    if (value === prevValue) return;
    if (prevValue !== undefined) {
        detachObject(prevValue);
    }
    if (valueTreeMeta !== undefined) {
        attach((current as This)._treeMeta, valueTreeMeta);
    }
}

export function detach(treeMeta: TreeMeta) {
    treeMeta.parent = undefined;
}

export function getObjTreeMeta<T>(obj: {} | undefined) {
    if (obj instanceof Object) {
        return (obj as This)._treeMeta;
    }
    return;
}

export function detachObject<T>(item: T): T {
    const treeMeta = getObjTreeMeta(item);
    if (treeMeta !== undefined) {
        detach(treeMeta);
    }
    return item;
}
