import { Base } from './Entity';
import { RootStore } from './RootStore';

let idCounter = 0;
export class TreeMeta<T = {}> {
    id: string | number = ++idCounter;
    _id: string | number | undefined = undefined;
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
        if (!(t instanceof TreeMeta)) {
            return t;
        }
        t = t.parent;
    }
    return;
}
export function getRootStoreFromObj(obj: {} | undefined): RootStore {
    if (obj instanceof Object) {
        return getRootStore((obj as Base)._treeMeta)!;
    }
    return undefined!;
}

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

export function getObjTreeMeta<T>(obj: {} | undefined) {
    if (obj instanceof Object) {
        return (obj as Base)._treeMeta;
    }
    return;
}

export function detachObject(item: {} | undefined) {
    const treeMeta = getObjTreeMeta(item);
    if (treeMeta !== undefined) {
        const rootStore = getRootStore(treeMeta);
        if (rootStore === undefined) throw new Error('Object already has detached');
        rootStore.instances.delete(item as Base);
        treeMeta.parent = undefined;
    }
}
