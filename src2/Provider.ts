import { Children, Component } from 'react';
import * as PropTypes from 'prop-types';
import { RootStore } from './RootStore';

export class Provider extends Component<{ treeStore: RootStore }> {
    getChildContext() {
        return { treeStore: this.props.treeStore };
    }
    render() {
        return Children.only(this.props.children);
    }

    static childContextTypes = {
        treeStore: PropTypes.object,
    };
}
