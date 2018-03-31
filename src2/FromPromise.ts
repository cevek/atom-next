import { ErrBox, trxManager } from './Atom';
import { glob } from './Glob';

export function fromPromise<T>(promise: Promise<T>): T {
    if (trxManager.current.atom === undefined) {
        throw new Error('You cannot use fromPromise outside of get functions');
    }
    if (!(promise instanceof Promise)) {
        throw new Error('promise argument is not a Promise instance');
    }
    const atom = trxManager.current.atom!;

    function handler() {
        promise.then(
            value => {
                atom.set(value);
            },
            err => {
                atom.set(new ErrBox(err));
            }
        );
        // disable logging error for nodejs
        if (typeof process === 'object' && typeof process.once === 'function') {
            process.once('uncaughtException', err => {
                if (!trxManager.wait) {
                    throw err;
                }
            });
        }
        // throw maximum call stack exception
        handledStackOverflow();
    }

    if (typeof Proxy === 'function') {
        return new Proxy({}, { get: handler }) as T;
    }
    handler();
    return undefined!;
}

// noinspection InfiniteRecursionJS
function handledStackOverflow() {
    handledStackOverflow();
}

if (typeof window === 'object') {
    window.addEventListener('error', e => {
        if (trxManager.wait) {
            e.preventDefault();
        }
    });
}
