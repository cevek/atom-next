import { RootStore } from './RootStore';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { applyMiddleware, compose, createStore } from 'redux';
import { entity, sub } from './Decorators';
import { connect } from './Component';
import { array } from './Array';
import { hash } from './HashMap';

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

@entity
class Todo {
    title = 'new todo';
    isDone = false;
    done(isDone: boolean) {
        this.isDone = isDone;
    }
    constructor() {
        console.log('new Todo');
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

    constructor() {
        console.log('new TodoStore');
    }
}

@entity
class MyStore extends RootStore {
    @sub(TodoStore) todoStore = new TodoStore();
}

function run() {
    const composeEnhancers = w.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
    const reduxStore = createStore(
        state => state,
        /*state,*/
        composeEnhancers(applyMiddleware())
    );
    const store = new MyStore({ reduxStore });
    w.rootStore = store;
    // console.log(store);
    ReactDOM.render(
        <Provider store={reduxStore}>
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

function TodoList(props: Pick<TodoStore, 'todos' | 'unfinishedCount'>) {
    return (
        <div>
            {props.todos.map((todo, i) => <TodoItemHOC todo={todo} key={i} />)}
            <div>{props.unfinishedCount}</div>
        </div>
    );
}
const TodoListHOC = connect(TodoList, (store: MyStore) => {
    const { todos, unfinishedCount } = store.todoStore;
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
