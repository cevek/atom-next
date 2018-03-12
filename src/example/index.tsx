import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { App } from './App';
import './index.css';
import { Provider } from 'react-redux';
import { applyMiddleware, compose, createStore } from 'redux';
import { RootStore } from '../AtomTree';
import { TodoStore } from './Todo';
// import { store } from './lib/ARedux';

type M<T> = { [key: number]: T };
const state = {
    foo: {
        bar: {
            baz: [
                {
                    x: {
                        y: 1,
                        z: {
                            u: [1, 2, 3],
                        },
                    },
                },
            ],
        },
    },
    tooltip: {
        isLoading: {} as M<boolean>,
        content: {} as M<number>,
    },
};

//
// function loadTooltip(state: State, id: number, dispatch: Dispatch) {
//     s(state.tooltip.isLoading, id, true);
//     // reducers.page.push('2323');
//
//     setTimeout(() => dispatch(tooltopDone, id), 1000);
//     // return state;
// }
//
// function tooltopDone(state: State, id: number) {
//     s(state.tooltip.isLoading, id, false);
//     s(state.tooltip.content, id, Math.random());
//     // return state;
// }

export type State = typeof state;

function run() {
    const atomStore = new RootStore([TodoStore]);
    (window as any).atomStore = atomStore;
    const composeEnhancers = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
    const store = createStore(
        atomStore.mainReducer,
        /*state,*/
        composeEnhancers(applyMiddleware())
    );
    atomStore.setReduxStore(store);
    // console.log(store);
    ReactDOM.render(
        <Provider store={store}>
            <div>
                <App />
            </div>
        </Provider>,
        document.getElementById('root') as HTMLElement
    );
}

run();
