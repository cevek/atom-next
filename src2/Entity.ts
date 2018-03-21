import { TreeMeta } from './TreeMeta';
import { ClassMeta } from './ClassMeta';

export interface This<T = {}> {
    _treeMeta: TreeMeta<T>;
    _classMeta: ClassMeta;
}

export interface EntityClass<T = {}> {
    new (): This<T>;
    prototype: This<T>;
//    factory(elementClassMeta: ClassMeta, value: This<T>, prev: This<T> | undefined): This<T>;
}
