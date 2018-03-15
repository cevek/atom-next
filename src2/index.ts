import './diff';
import { RootStore } from './RootStore';
import { entity } from './Decorators';

new RootStore([]);

@entity
class Todo {}
