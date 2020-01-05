interface EventHandler {
  (ev: Event, el: Element): void;
}

console.log("navbar.js is evaluated");

export default class {
  readonly title: string = "I'm a member of a navbar class";

  constructor() {
    console.log("navbar ctor");
  }

  open(x: number, event: Event, element: Element): void {
    console.log("navbar.open() called with", x, "(a", typeof x + ") and event", event, "and element", element, "and this", this, "and title", this.title);
  }

  close() {}

  hello(i: number, str: string) {
    console.log("navbar.hello()");
    return `hello ${str} youre #${i}!`;
  }

  onClickMe: EventHandler = (ev, el) => console.log("onClickMe", ev, el);

  onClickopen = () => console.log("onclickOpen");
}
