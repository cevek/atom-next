import * as React from 'react';
import * as PropTypes from 'prop-types';
import { CustomStore, RootStore } from './RootStore';
import { AtomCalc } from './Atom';

type Omit<A, B> = { [P in Exclude<keyof A, keyof B>]: A[P] };
let callFromRender = false;
export function connect<Props, StateProps extends Partial<Props>, HOCProps>(
    render: React.SFC<Props>,
    stateToProps?: (store: RootStore, props: HOCProps) => StateProps
): React.ComponentClass<Omit<Props, StateProps> & HOCProps> {
    return class Connect extends React.PureComponent<Omit<Props, StateProps> & HOCProps> {
        static displayName = render.name ? `Connect(${render.name})` : 'Connect';
        static contextTypes = { store: PropTypes.object };
        context!: { store: CustomStore };
        update = () => this.forceUpdate();
        timeout = -1;
        atom = new AtomCalc(this, this.atomRender);
        atomRender() {
            if (!callFromRender) {
                clearTimeout(this.timeout);
                this.timeout = setTimeout(this.update);
                return;
            }
            const newProps = Object.assign(
                {},
                this.props,
                stateToProps === undefined ? undefined : stateToProps(this.context.store.atomStore, this.props as any)
            ) as any;
            return render(newProps);
        }
        render() {
            try {
                callFromRender = true;
                this.atom.reset();
                return this.atom.get();
            } finally {
                callFromRender = false;
            }
        }
        componentWillUnmount() {
            this.atom.detach();
        }
    };
}
