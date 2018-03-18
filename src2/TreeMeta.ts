import { AtomValue } from './Atom';
import { This } from './Entity';
import { RootStore } from './RootStore';
import { JsonType } from './Utils';

export class TreeMeta<T = {}> {
    id: string | number | undefined = undefined;
    parent: TreeMeta | undefined = undefined;
    json: JsonType = undefined;
    atoms: { [key: string]: AtomValue } = {};
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

export function attach(parent: TreeMeta, treeMeta: TreeMeta) {
    treeMeta.parent = parent;
    if (treeMeta.id === undefined) {
        const rootStore = getRootStore(parent);
        if (rootStore !== undefined) {
            treeMeta.id = rootStore.lastId++;
        }
    }
}

export function attachObject(current: This, value: {}) {
    const valueTreeMeta = getObjTreeMeta(value);
    if (valueTreeMeta !== undefined) {
        attach(current._treeMeta, valueTreeMeta);
    }
}

export function detach(treeMeta: TreeMeta) {
    treeMeta.parent = undefined;
}

export function getObjTreeMeta<T>(obj: {}) {
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
