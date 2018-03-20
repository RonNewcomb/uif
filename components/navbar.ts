
console.log("navbar.js is evaluated");

export default class {
    constructor() {
        console.log("navbar ctor");
    }
    member = "i'm a member of this class";

    open(x: any, event: Event, element: Element): void {
        console.log("navbar.open() called with x", x, "and event", event, "and element", element, "and this", this, "and this.member", this.member);

    }

    close() {

    }

}
