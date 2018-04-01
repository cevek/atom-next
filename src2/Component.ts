import * as React from 'react';
import * as PropTypes from 'prop-types';
import { RootStore } from './RootStore';
import { AtomCalc } from './Atom';

export type OmitProps<A, B> = { [P in Exclude<keyof A, keyof B>]: A[P] };
let callFromRender = false;
export function connect<Store extends RootStore, Props, StateProps extends Partial<Props>, HOCProps>(
    render: React.SFC<Props>,
    stateToProps?: (store: Store, props: HOCProps) => StateProps
): React.ComponentClass<OmitProps<Props, StateProps> & HOCProps> {
    return class Connect extends React.PureComponent<OmitProps<Props, StateProps> & HOCProps> {
        static displayName = render.name ? `Connect(${render.name})` : 'Connect';
        static contextTypes = { treeStore: PropTypes.object };
        context!: { treeStore: RootStore };
        update = () => this.forceUpdate();
        timeout = -1;
        atom = new AtomCalc(this, this.atomRender, 'Component:' + render.name);
        atomRender() {
            if (!callFromRender) {
                clearTimeout(this.timeout);
                this.timeout = setTimeout(this.update);
                return;
            }
            const newProps = (Object.assign(
                {},
                this.props,
                stateToProps === undefined
                    ? undefined
                    : stateToProps(this.context.treeStore as Store, this.props as never)
            ) as {}) as Props;
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
