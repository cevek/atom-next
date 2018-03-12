import * as React from 'react';
import { component } from '../Component';
import { array, root } from '../reflect/store';

@root
export class Todo {
    content = '';
    isDone: boolean = false;

    toggle() {
        this.isDone = !this.isDone;
    }

    done() {
        this.isDone = true;
    }
}

// prepareEntity(Todo, ['isDone', 'content'], [], {});

let id = 0;

@root
export class TodoStore {
    todos = array(Todo, []);

    addTodo(content: string) {
        const todo = new Todo();
        todo.content = content;
        this.todos.push(todo);
        return todo;
    }

    constructor() {
        const todo = new Todo();
        todo.content = 'Foo';
        this.todos.push(todo);
    }

    removeTodo(todo: Todo) {
        const pos = this.todos.indexOf(todo);
        if (pos > -1) {
            this.todos.splice(pos, 1);
        }
    }

    doneAll() {
        this.todos.forEach(todo => {
            todo.done();
        });
    }

    loadTodo(foo: number) {
        setTimeout(() => {
            this.doneAll();
        });
    }
}

console.dir(Todo);
console.dir(TodoStore);


// prepareEntity(TodoStore, ['todos'], ['loadTodo'], { todos: [Todo] });

export const TodoList = component(TodoStore)<{}>((props, store) => {
    console.log(store.todos);
    return (
        <div>
            {store.todos.map((todo, i) => <TodoView key={i} todo={todo} />)}
            <div>
                <button onClick={() => store.addTodo('Yeah ' + id++)}>Add</button>
                <button onClick={() => store.doneAll()}>Done All</button>
            </div>
        </div>
    );
});

export const TodoView = component(TodoStore)<{ todo: Todo }>(({ todo }, store) => (
    <div>
        <div>
            <button onClick={() => store.removeTodo(todo)}>Remove</button>
            <button onClick={() => todo.toggle()}>{todo.isDone ? '-' : 'X'}</button>
            {todo.content}
        </div>
    </div>
));
