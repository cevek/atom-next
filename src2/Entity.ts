import { TreeMeta } from './TreeMeta';
import { ClassMeta } from './ClassMeta';

export interface This<T = {}> {
    _treeMeta: TreeMeta<T>;
    _classMeta: ClassMeta;
    toJSON(): {};
}

export interface EntityClass<T = {}> {
    new (): This<T>;
    prototype: This<T>;
}
