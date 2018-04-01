import { addField } from './EntityUtils';
import { ClassMeta } from './ClassMeta';
import { Base } from './Entity';

export type Ref<T> = T | undefined;

export function ref<T>(Class: typeof Base) {
    return function<Prop extends string, Trg extends Base /* & Record<Prop, Map<number | string, T> | undefined>*/>(
        targetProto: Trg,
        prop: Prop
    ) {
        addField(targetProto, prop, refType(Class));
    };
}

export function refType(Class: typeof Base) {
    return new ClassMeta({
        setTransformer: (rootStore, value) => {
            if (value instanceof Base) {
                return value.id;
            }
            throw new Error('Value is not instance of the Base class');
        },
        getTransformer: (rootStore, value) => {
            if (rootStore !== undefined) {
                return rootStore.instances.get(Class, value as string);
            }
        },
    });
}