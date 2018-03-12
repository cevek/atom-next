import { connect } from './connect';
import { array, root, maybe } from './store';
//
// const My = connect(Register, ({ b, c, d, instance }, props: { channelId: number }) => {
//     const { isVisible, setVisible } = instance(RegisterState, props.channelId);
//     return { b, c, d, isVisible, setVisible };
// });
//
// My({ a: 1, channelId: 1 });

type StateProps = Pick<State, 'b' | 'c'> & Pick<RegisterStore, 'isVisible' | 'setVisible'>;

function Register(props: { a: number } & StateProps) {
    return props.a + props.b + props.c + props.setVisible(true);
}

@root
class RegisterStore {
    isVisible = false;
    items = array(Foo, []);
    bla = maybe(Foo);

    get name() {
        console.log(1235);
        return 123;
    }

    setVisible(visible: boolean) {
        this.isVisible = visible;
    }
}

class Foo {
    name = '';
}

class Bar {
    b = 'abc';
}

class State {
    b = 'abc';
    c = 123;
    d = true;
    instance<T>(Class: new () => T, key?: string | number): T {
        return null!;
    }
}

// window.RegisterStore = RegisterStore;
console.log(RegisterStore);
