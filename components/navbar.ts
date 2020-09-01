import { EventHandler } from 'uif';

export default class {
  title: string = "I'm a member of a navbar class";

  constructor() {
    console.log(this.title);
  }

  open(x: number, event: Event, element: Element): void {
    this.title = "navbar.open() called with " + x + " (a " + typeof x + ") and event " + event + " and element " + element + " and this " + this + " and title " + this.title;
    console.log(this.title);
  }

  onclick2(x: number, event: Event, element: Element): void {
    this.title = "navbar.onClick2() called with " + x + " (a " + typeof x + ") and event " + event + " and element " + element + " and this " + this;
    console.log(this.title);
  }

  close() { }

  hello(i: number, str: string) {
    this.title = "navbar.hello()";
    console.log(this.title);
    return `hello ${str} youre #${i}!`;
  }

  onClickMe: EventHandler = (ev, el) => (this.title = "onClickMe") && console.log("onClickMe", ev, el);

  onClickopen = () => (this.title = ("onclickOpen")) && console.log(this.title);

}
