
console.log("navbar.js is evaluated");

export default class {
    readonly title: string = "I'm a member of a navbar class";

    constructor() {
        console.log("navbar ctor");
    }

    open(x: number, event: Event, element: Element): void {
        console.log("navbar.open() called with", x, "(a", typeof x + ") and event", event, "and element", element, "and this", this, "and title", this.title);
    }

    close() {
    }

    hello() {
        console.log("hello world");
    }
}
