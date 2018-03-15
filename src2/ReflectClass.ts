export interface ReflectClassResult {
    props: string[];
    prototype: (
        | { type: 'method' | 'getter' | 'setter'; name: string; value: Function }
        | { type: 'prop'; name: string; value: any })[];
}

export function reflectClass(Class: Function): ReflectClassResult {
    const prototype = getPrototypeInfo(Class);
    const props = parseFieldsFromCtor(Class, prototype);
    return {
        props,
        prototype,
    };
}

function parseFieldsFromCtor(Class: Function, prototype: ReflectClassResult['prototype']) {
    let source = Class.toString();
    for (let i = 0; i < prototype.length; i++) {
        const p = prototype[i];
        if (p.type !== 'prop') {
            source = source.replace(p.value.toString(), '');
        }
    }
    //https://stackoverflow.com/a/2008444/1024431
    // get all assignings to this in constructor
    const re = /this\.([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*?)\s*=/g;
    let m;
    let keyMap: { [key: string]: boolean } = {};
    while ((m = re.exec(source))) {
        const key = m[1];
        keyMap[m[1]] = true;
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
        if (descriptor.get !== undefined) {
            res.push({
                type: 'getter',
                name: key,
                value: descriptor.get,
            });
        } else if (descriptor.set !== undefined) {
            res.push({
                type: 'setter',
                name: key,
                value: descriptor.set,
            });
        } else {
            res.push({
                type: typeof descriptor.value === 'function' ? 'method' : ('prop' as 'method'),
                name: key,
                value: descriptor.value,
            });
        }
    }
    return res;
}
