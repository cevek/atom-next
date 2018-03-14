export interface ReflectClassResult {
    props: string[];
    prototype: (
        | { type: 'method'; name: string; method: Function }
        | { type: 'getter'; name: string; get?: Function; set?: Function }
        | { type: 'prop'; name: string; value: any })[];
}

export function reflectClass(Class: Function): ReflectClassResult {
    return {
        props: parseFieldsFromCtor(Class),
        prototype: getPrototypeInfo(Class),
    };
}

function parseFieldsFromCtor(Class: Function) {
    const methodsNames = Object.getOwnPropertyNames(Class.prototype);
    let source = Class.toString();
    const methods: Function[] = [];
    for (let i = 0; i < methodsNames.length; i++) {
        const method = methodsNames[i];
        if (method === 'constructor') continue;
        const descr = Object.getOwnPropertyDescriptor(Class.prototype, method)!;
        if (typeof descr.get === 'function') methods.push(descr.get);
        if (typeof descr.set === 'function') methods.push(descr.set);
        if (typeof descr.value === 'function') methods.push(descr.value);
    }
    for (let i = 0; i < methods.length; i++) {
        const method = methods[i];
        source = source.replace(method.toString(), '');
    }
    //https://stackoverflow.com/a/2008444/1024431
    // get all assignings to this in constructor
    const re = /this\.([_$a-zA-Z\xA0-\uFFFF][^_$a-zA-Z0-9\xA0-\uFFFF]*?)\s*=/g;
    let m;
    let keyMap: { [key: string]: boolean } = {};
    while ((m = re.exec(source))) {
        const key = m[1];
        if (methodsNames.indexOf(key) === -1) {
            keyMap[m[1]] = true;
        }
    }
    return Object.keys(keyMap);
}

function getPrototypeInfo(Class: Function) {
    const prototypeKeys = Object.getOwnPropertyNames(Class.prototype);
    const res: ReflectClassResult['prototype'] = [];
    for (let i = 0; i < prototypeKeys.length; i++) {
        const key = prototypeKeys[i];
        if (key === 'constructor') continue;
        const descriptor = Object.getOwnPropertyDescriptor(Class.prototype, key)!;
        if (descriptor.get !== undefined || descriptor.set !== undefined) {
            res.push({
                type: 'getter',
                name: key,
                get: descriptor.get,
                set: descriptor.set,
            });
        } else if (typeof descriptor.value === 'function') {
            res.push({
                type: 'method',
                name: key,
                method: descriptor.value,
            });
        } else {
            res.push({
                type: 'prop',
                name: key,
                value: descriptor.value,
            });
        }
    }
    return res;
}
