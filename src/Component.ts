import * as React from 'react';
import * as PropTypes from 'prop-types';

import { AtomProxy, AtomValue, CustomStore, glob, Index, initValueIfNeeded } from './AtomTree';

export function component<Store>(StoreCtor: { new (): Store }) {
    return <Props>(cmp: (props: Props & { children?: React.ReactNode }, store: Store) => React.ReactNode) => {
        return class extends React.Component<Props> {
            static displayName = cmp.name;
            static contextTypes = { store: PropTypes.object };
            context!: { store: CustomStore };
            listenedProps: (AtomProxy | AtomValue)[] = [];

            shouldComponentUpdate(nextProps: this['props'], nextState: this['state'], nextContext: this['context']) {
                if (nextProps !== this.props) {
                    const keys = Object.keys(this.props);
                    for (let i = 0; i < keys.length; i++) {
                        const key = keys[i];
                        if ((nextProps as Index)[key] !== (this.props as Index)[key]) {
                            return true;
                        }
                    }
                }
                for (let i = 0; i < this.listenedProps.length; i++) {
                    const prop = this.listenedProps[i];
                    if (!prop._attached) {
                        return true;
                    }
                }
                return false;
            }

            unsubscribe: () => void = undefined!;
            isMount = true;

            componentWillMount() {
                this.unsubscribe = this.context.store.subscribe(() => {
                    setTimeout(() => {
                        if (this.isMount) {
                            this.setState({ x: Math.random() });
                        }
                    });
                });
            }

            componentWillUnmount() {
                this.unsubscribe();
                this.isMount = false;
            }

            render() {
                const { store } = this.context;
                glob.usingProxies = [];
                try {
                    const storeKeyIdx = store.atomStore._factoryMap.get(StoreCtor.name);
                    if (storeKeyIdx === void 0) {
                        throw new Error('Store "' + StoreCtor.name + '" is not registered in the RootStore instance');
                    }
                    const ret = cmp(this.props, (initValueIfNeeded(store.atomStore, storeKeyIdx) as {}) as Store);
                    this.listenedProps = glob.usingProxies;
                    return ret;
                } finally {
                    glob.usingProxies = void 0;
                }
            }
        };
    };
}
