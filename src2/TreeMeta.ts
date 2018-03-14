import { Atom } from '../src/atom';
import { This } from './utils';
import { RootStore } from './RootStore';

export class TreeMeta<T = {}> {
    id: string | number | undefined = undefined;
    key: string | number | undefined = undefined;
    parent: TreeMeta | undefined = undefined;
    json: T | undefined = undefined;
    atoms: { [key: string]: Atom } = {};
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

export function attach(parent: TreeMeta, key: string | number, treeMeta: TreeMeta) {
    treeMeta.parent = parent;
    treeMeta.key = key;
    if (treeMeta.id === undefined) {
        const rootStore = getRootStore(parent);
        if (rootStore !== undefined) {
            treeMeta.id = rootStore.lastId++;
        }
    }
}
export function detach(treeMeta: TreeMeta) {
    treeMeta.parent = undefined;
    treeMeta.key = undefined;
}

export function getObjTreeMeta<T>(obj: any) {
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
