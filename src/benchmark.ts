import {prop} from "./prop";
import {Atom, TaskList} from "./index";


export function atomBenchmark() {
    TaskList.microTaskRunner = ()=>null;

    class ModelA {
        @prop a0 = 1;
        @prop a1 = 1;
        @prop a2 = 1;
        @prop a3 = 1;
        @prop a4 = 1;
        @prop a5 = 1;
        @prop a6 = 1;
        @prop a7 = 1;
        @prop a8 = 1;
        @prop a9 = 1;

        @prop get sum() {
            return this.a0 + this.a1 + this.a2 + this.a3 + this.a4 + this.a5 + this.a6 + this.a7 + this.a8 + this.a9;
        }
    }

    class ModelB {
        @prop a0 = 1;
        @prop a1 = 1;
        @prop a2 = 1;
        @prop a3 = 1;
        @prop a4 = 1;
        @prop a5 = 1;
        @prop a6 = 1;
        @prop a7 = 1;
        @prop a8 = 1;
        @prop a9 = 1;

        @prop get sum() {
            return this.a0 % 2 === 0 ? (this.a1 + this.a2 + this.a3 + this.a4 + this.a5 + this.a6 + this.a7 + this.a8 + this.a9) : 0;
        }
    }

    class ModelC {
        @prop a0 = 1;
        @prop a1 = 1;
        @prop a2 = 1;
        @prop a3 = 1;
        @prop a4 = 1;
        @prop a5 = 1;
        @prop a6 = 1;
        @prop a7 = 1;
        @prop a8 = 1;
        @prop a9 = 1;

        @prop get sum() {
            let sum = this.a0 + this.a1 + this.a2 + this.a3 + this.a4 + this.a5 + this.a6 + this.a7 + this.a8;
            for (var i = 0; i < 10; i++) {
                sum += this.a9;
            }
            return sum;
        }
    }

    const modelA = new ModelA();
    modelA.sum;

    const modelB = new ModelB();
    modelB.sum;

    const modelC = new ModelC();
    modelC.sum;

    function createAtoms() {
        console.time('create 10m atoms');
        // console.profile('x');
        for (var i = 0; i < 1000000; i++) {
            new ModelA();
        }
        // console.profileEnd('x');
        console.timeEnd('create 10m atoms');
    }

    function refresh() {
        console.time('refresh 1m computed atoms');
        // console.profile('x');
        for (var i = 0; i < 1000000; i++) {
            modelA.a0 = i;
            Atom.updateScheduled()
        }
        // console.profileEnd('x');
        console.timeEnd('refresh 1m computed atoms');
    }

    function refreshWithDuplicates() {
        console.time('refresh 1m computed atoms with duplicates masters');
        // console.profile('x');
        for (var i = 0; i < 1000000; i++) {
            modelC.a0 = i;
            Atom.updateScheduled()
        }
        // console.profileEnd('x');
        console.timeEnd('refresh 1m computed atoms with duplicates masters');
    }

    function recreate() {
        console.time('recreate 1m masters of computed atom');
        // console.profile('x');
        for (var i = 0; i < 1000000; i++) {
            modelB.a0 = i;
            Atom.updateScheduled()
        }
        // console.profileEnd('x');
        console.timeEnd('recreate 1m masters of computed atom');
    }

    // console.profile('a')
    createAtoms();
    refresh();
    refreshWithDuplicates();
    recreate();
    // (console as any).profileEnd('a')
    console.log(modelA, modelB, modelC);


    /*
    Results:

     create 10m atoms: 198.765ms
     refresh 1m computed atoms: 540.159ms
     refresh 1m computed atoms with duplicates masters: 788.877ms
     recreate 1m masters of computed atom: 603.227ms
     
     */
}