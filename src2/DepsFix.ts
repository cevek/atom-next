import { ArrayProxy } from './Array';
import { HashMap } from './HashMap';

export const DepsFix = {
    ArrayProxy: undefined!,
    HashMap: undefined!,
} as { ArrayProxy: typeof ArrayProxy; HashMap: typeof HashMap };
