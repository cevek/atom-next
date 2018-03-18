import { RootStore } from './RootStore';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { applyMiddleware, compose, createStore } from 'redux';
import { array, entity, hash, sub } from './Decorators';
import { connect } from './Component';

const w: any = window;
class Async<T> {
    constructor(private fn: () => Promise<T>) {}
    private data: T | undefined = undefined;
    private error: Error | undefined = undefined;
    private loading = false;
    private setData(data: T | undefined, error: Error | undefined) {
        this.data = data;
        this.error = error;
    }
    get(options: { force?: boolean } = {}) {
        if (!options.force && this.data !== undefined) return this.data;
        this.fn().then(data => () => this.setData(data, undefined), err => this.setData(undefined, err));
        return undefined;
        // throw new Error();
    }
}

function getUsers() {
    return fetch('').then<{ id: number }[]>(data => data.json());
}

class TodoList1 {
    users = new Async(() => getUsers());
    todos = new Async(() => getUsers());
}
// const users = new TodoList().users.get()!;

// users[0].id;

function run() {
    const atomStore = new RootStore([TodoStore]);
    (window as any).atomStore = atomStore;
    const composeEnhancers = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
    const store = createStore(
        atomStore.reducer,
        /*state,*/
        composeEnhancers(applyMiddleware())
    );
    atomStore.setReduxStore(store);
    w.rootStore = atomStore;
    // console.log(store);
    ReactDOM.render(
        <Provider store={store}>
            <TodoListHOC />
        </Provider>,
        document.getElementById('root') as HTMLElement
    );

    // autorun(() => {
    //     const todoStore = atomStore.getInstance(TodoStore);
    //     w.todoStore = todoStore;
    //     console.log(todoStore.todos.map(todo => `${todo.title} [${todo.done ? '+' : '*'}]`));
    //     console.log(todoStore);
    // });
}

@entity
class Todo {
    title = 'new todo';
    isDone = false;
    done(isDone: boolean) {
        this.isDone = isDone;
    }
}

@entity
class User {}

@entity
class Fav {
    name = 'fav';
}

@entity
class TodoStore {
    @array(Todo) todos: Todo[] = [];
    @sub(User) user: User | undefined = undefined;

    @hash(Fav) favs = new Map<number, Fav>();

    addTodo(todo: Todo) {
        this.todos.push(todo);
    }
    removeTodo(todo: Todo) {
        const pos = this.todos.indexOf(todo);
        if (pos > -1) {
            this.todos.splice(pos, 1);
        }
    }
    get unfinishedCount() {
        return this.todos.reduce((sum, todo) => sum + (todo.isDone ? 0 : 1), 0);
    }
}

function TodoList(props: Pick<TodoStore, 'todos' | 'unfinishedCount'>) {
    return (
        <div>
            {props.todos.map((todo, i) => <TodoItemHOC todo={todo} key={i} />)}
            <div>{props.unfinishedCount}</div>
        </div>
    );
}
const TodoListHOC = connect(TodoList, store => {
    const { todos, unfinishedCount } = store.getInstance(TodoStore);
    return { todos, unfinishedCount };
});

const TodoItemHOC = connect(TodoItem);
function TodoItem(props: { todo: Todo }) {
    return (
        <div>
            <label style={{ textDecoration: props.todo.isDone ? 'line-through' : undefined }}>
                <input
                    checked={props.todo.isDone}
                    onChange={() => props.todo.done(!props.todo.isDone)}
                    type="checkbox"
                />{' '}
                {props.todo.title}
            </label>
        </div>
    );
}

w.TodoList = TodoList;
w.TodoListHOC = TodoListHOC;
w.Todo = Todo;
w.TodoStore = TodoStore;
run();
