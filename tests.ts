import {BaseArray} from "./base-array";
import {prop} from "./prop";
import {autowatch} from "./autowatch";
class User {
    @prop firstName:string;
    @prop lastName:string;

    constructor(firstName:string, lastName:string) {
        this.firstName = firstName;
        this.lastName = lastName;
    }

    @prop get fullName() {
        return this.firstName + ' ' + this.lastName;
    }

    @prop a1 = '123';
    @prop b2 = '123';
    @prop c3 = '123';
    @prop d4 = '123';
    @prop e5 = '123';
    @prop e6 = '123';
    @prop e7 = '123';
    @prop e8 = '123';
}

const users = new BaseArray<User>([]);
users.push(new User('Ivan', 'Petrashev'));
users.push(new User('Alex', 'Keffir'));
users.push(new User('Sergio', 'Valse'));

@autowatch
class TempRender {
    forceUpdate() {
        this.render();
    }

    render() {
        console.log('render', users.map(user => user.fullName).join());
    }
}

new TempRender().forceUpdate();

(window as any).users = users;

