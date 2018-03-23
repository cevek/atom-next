import { RootStore } from './RootStore';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { sub } from './Decorators';
import { connect } from './Component';
import { array } from './Array';
import { Provider } from './Provider';
import { Base } from './Entity';

const { connectViaExtension, extractState } = require('remotedev');
const remotedev = connectViaExtension();

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

let id = 0;
class Todo extends Base {
    id = ++id;
    title = 'new todo';
    isDone = false;
    done(isDone: boolean) {
        this.isDone = isDone;
    }
}

// class User extends Base {}
//
// class Fav extends Base {
//     name = 'fav';
// }

class TodoStore extends Base {
    @array(Todo) todos: Todo[] = [];
    // @sub(User) user: User | undefined = undefined;

    // @hash(Fav) favs = new Map<number, Fav>();

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
        super();
    }
}

class MyStore extends RootStore {
    @sub(TodoStore) todoStore = TodoStore.create();
}

function run() {
    //{ todoStore: { todos: [], user: {}, favs: undefined, unfinishedCount: 0 } }
    const store = MyStore.create();
    remotedev.subscribe((message: any) => {
        const state = extractState(message);
        store.setState(state);
    });
    store.subscribe((action, state) => {
        remotedev.send(action, state);
    });
    w.rootStore = store;
    ReactDOM.render(
        <Provider treeStore={store}>
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

class TodoItemStore extends Base {
    visible = false;
    setVisible(visible: boolean) {
        this.visible = visible;
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
const TodoListHOC = connect(TodoList, (store: MyStore) => {
    const { todos, unfinishedCount } = store.todoStore;
    return { todos, unfinishedCount };
});

const TodoItemHOC = connect(TodoItem, (store: MyStore, props: { todo: Todo }) => {
    const local = store.getInstance(TodoItemStore, props.todo.id);
    return { local };
});
function TodoItem(props: { todo: Todo; local: TodoItemStore }) {
    // console.log(props.local);
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
            <input
                checked={props.local.visible}
                onChange={() => props.local.setVisible(!props.local.visible)}
                type="checkbox"
            />{' '}
            {props.local.visible ? 'Yes' : 'No'}
        </div>
    );
}

w.TodoList = TodoList;
w.TodoListHOC = TodoListHOC;
w.Todo = Todo;
w.TodoStore = TodoStore;
run();
