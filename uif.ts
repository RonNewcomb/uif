const standardTags = [
  "a",
  "abbr",
  "acronym",
  "address",
  "applet",
  "area",
  "article",
  "aside",
  "audio",
  "b",
  "base",
  "basefont",
  "bdo",
  "big",
  "blockquote",
  "body",
  "br",
  "button",
  "canvas",
  "caption",
  "center",
  "cite",
  "code",
  "col",
  "colgroup",
  "data",
  "datalist",
  "dd",
  "del",
  "dfn",
  "dir",
  "div",
  "dl",
  "dt",
  "em",
  "embed",
  "fieldset",
  "figcaption",
  "figure",
  "font",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hgroup",
  "hr",
  "html",
  "i",
  "iframe",
  "img",
  "input",
  "ins",
  "isindex",
  "kbd",
  "keygen",
  "label",
  "legend",
  "li",
  "link",
  "listing",
  "map",
  "mark",
  "marquee",
  "menu",
  "meta",
  "meter",
  "nav",
  "nextid",
  "nobr",
  "noframes",
  "noscript",
  "object",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "param",
  "picture",
  "plaintext",
  "pre",
  "progress",
  "q",
  "rt",
  "ruby",
  "s",
  "samp",
  "script",
  "section",
  "select",
  "small",
  "source",
  "span",
  "strike",
  "strong",
  "style",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "template",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "title",
  "tr",
  "track",
  "tt",
  "u",
  "ul",
  "var",
  "video",
  "wbr",
  "x-ms-webview",
  "xmp"
].reduce((sum, cur) => {
  sum[cur.toUpperCase()] = true;
  return sum;
}, <{ [key: string]: boolean }>{});

// interfaces ////////

interface TagName extends String { }
interface FileContents extends String { }
interface FileExtension extends String { }
interface ControllerCtor {
  new(instance?: ComponentInstance): Controller;
}
interface Dictionary<T = any> {
  [key: string]: T;
}
interface Controller extends ControllerCtor, Dictionary<any> { }

export type ValidationFnReturn = (boolean | string) | Promise<boolean | string>;

export interface ValidationFn {
  (val: string/* unless already mapped to number/boolean/Date*/, form: HTMLFormElement | null): ValidationFnReturn;
}
interface ValErrorsController {
  errors?: ArrayKeys<Dictionary<string>>;
}
interface ValidatingController extends Dictionary<ValidationFn> /*,ValErrorsController */ { }

type ElementWithController = Element & { uifComponent: ComponentInstance };
type ElementWithValidators = Element & { uifValidators?: string[] };
type ElementWithValue = Element & { value: string; name?: string };
type ArrayKeys<T> = Array<T> & Dictionary<T>;

interface ComponentDefinition {
  css: FileContents | undefined;
  html: FileContents | undefined;
  js: ControllerCtor | undefined;
  loading?: Promise<any>;
  controllerMembers?: string[]; // cache
  substitutions?: Substitution[]; // cache
}

const enum SubstitutionTypes {
  Property,
  MethodInvocation,
  EventHandler,
  Validator
}

interface ComponentInstance {
  definition: ComponentDefinition;
  element: ElementWithController;
  controller?: Controller;
  originalInnerHTML?: string;
}

export interface EventHandler {
  (event: Event, element: Element): void;
}

declare global {
  interface Window {
    uif: {
      validate: (inputElement: ElementWithValidators, event: Event) => void;
      handle: (element: Element, event: Event, method: string, ...rest: any[]) => Promise<void>;
    }
  }
}

// utility /////////////////////////////////

const protobj = Object.getPrototypeOf(new Object());
export function getMembers(obj: object) {
  const p: string[] = [];
  for (; obj && obj != protobj; obj = Object.getPrototypeOf(obj)) {
    const op: string[] = Object.getOwnPropertyNames(obj);
    for (let i = 0; i < op.length; i++) if (p.indexOf(op[i]) == -1) p.push(op[i]);
  }
  return p;
}

// static data /////////////////////////////////

export const StandardValidators: Dictionary<ValidationFn> = {
  mustBe: (val: string) => !!val,
};
window.uif = {} as any;

const namesOfStandardValidators = getMembers(StandardValidators);
const innerHtmlRegex = new RegExp(`{innerHTML}`, "g");
const inputFormFields = ["TEXTAREA", "INPUT", "SELECT"];
export let VALID = 'approval';
export let INVALID = 'needsWork';
export let VALIDATING = 'reviewing';
const filesCache = new Map<TagName, ComponentDefinition>();
const browserToParseHTML = (milliseconds?: number) => new Promise(r => setTimeout(r, milliseconds));
export { browserToParseHTML as wait };
const eventTypes = Object.keys(window)
  .filter(k => k.startsWith("on"))
  .sort((a, b) => b.length - a.length);

// setup /////////////////////////////////

const RegexPerSubType: Map<SubstitutionTypes, (key: string) => RegExp> = new Map([
  [SubstitutionTypes.MethodInvocation, key => new RegExp(`{(${key})\\(([^)]*)\\)}`)],
  [SubstitutionTypes.EventHandler, key => new RegExp(`\\s${key}(?!=)(?!')\\b(\\(([^)]*)\\))?`, "i")],
  [SubstitutionTypes.Validator, key => new RegExp(`\\s${key}(?!=)\\b`, "gi")],
  [SubstitutionTypes.Property, key => new RegExp(`{${key}}`, "g")]
]);

class Substitution {
  key: string;
  type: SubstitutionTypes;
  regex: RegExp;
  eventType?: string;

  constructor(key: string, ctrl: Controller) {
    this.key = key;
    if (typeof ctrl[key] !== "function") this.type = SubstitutionTypes.Property;
    else if (key.startsWith("must")) this.type = SubstitutionTypes.Validator;
    else if (!key.startsWith("on")) this.type = SubstitutionTypes.MethodInvocation;
    else {
      key = key.toLowerCase();
      this.eventType = eventTypes.find(et => key.startsWith(et));
      this.type = this.eventType ? SubstitutionTypes.EventHandler : SubstitutionTypes.MethodInvocation;
    }
    this.regex = RegexPerSubType.get(this.type)!(key);
  }
}

// event handling /////////////////////////////////

window.uif.handle = async (element: Element, event: Event, method: string, ...rest: any[]) => {
  var componentElement = element.closest('[component]') as ElementWithController;
  if (!componentElement.uifComponent.controller || !componentElement.uifComponent.controller[method]) {
    console.error("Method '", method, "not found on component", componentElement.tagName);
    return;
  }
  componentElement.uifComponent.controller[method](...rest, event, element);
  render(componentElement.uifComponent);
}


// form validating /////////////////////////////////

window.uif.validate = async (wrapperElement: ElementWithValidators, event: Event) => {
  const inputElement = (event.target as any) as ElementWithValue;

  const componentElement = wrapperElement.closest("[component]") as ElementWithController;
  if (!componentElement) {
    console.error("Form input field on", wrapperElement, "is outside of uif-controlled DOM");
    return;
  }

  const ctrl: Dictionary<ValidationFn> = componentElement.uifComponent.controller || StandardValidators;

  const form = wrapperElement.closest("form");
  let needsWorks = 0;
  let reviews: Promise<void>[] = [];
  for (const valFnName of (wrapperElement.uifValidators || [])) {
    const validator = ctrl[valFnName] || StandardValidators[valFnName];
    if (!validator) {
      console.error("Cannot find validation function", valFnName);
      continue;
    }
    const result = validator(inputElement.value, form);
    if (result instanceof Promise) {
      const review = result.catch(e => e ? e.toString() : valFnName + " threw").then(r => annotateElement(wrapperElement, valFnName, r, true));
      reviews.push(review);
    } else {
      annotateElement(wrapperElement, valFnName, result);
      if (!result) needsWorks++;
    }
  }
  setReviewing(wrapperElement, reviews.length);
  if (needsWorks > 0)
    setIsValid(wrapperElement, false); // if invalid show immediately
  if (reviews.length > 0)
    await Promise.all(reviews); // if pending async wait
  else if (needsWorks === 0)
    setIsValid(wrapperElement, true); // if none were async then we can finally say VALID
};

function annotateElement(el: Element, valFnName: string | number, result: boolean | string, decreaseReviewing: boolean = false) {
  if (result)
    el.removeAttribute(valFnName.toString())
  else {
    el.setAttribute(valFnName.toString(), typeof result === "string" && result ? result : "");
    setIsValid(el, false);
  }
  if (decreaseReviewing) {
    const howManyLeft = setReviewing(el, getReviewing(el) - 1);
    if (howManyLeft < 1) setIsValid(el, !el.hasAttribute(INVALID));
  }
}

function getReviewing(el: Element): number {
  return Number(el.getAttribute(VALIDATING) || "0");
}

function setReviewing(el: Element, howMany: number) {
  if (howMany < 1) el.removeAttribute(VALIDATING);
  else el.setAttribute(VALIDATING, howMany.toString());
  return howMany;
}

function setIsValid(el: Element, good: boolean) {
  if (good) {
    el.setAttribute(VALID, "");
    el.removeAttribute(INVALID);
  } else {
    el.setAttribute(INVALID, "");
    el.removeAttribute(VALID);
  }
}


// initialization /////////////////////////////////////////////////

async function getFile(tag: TagName, ext: FileExtension): Promise<FileContents | undefined> {
  tag = tag.toLowerCase();
  const resource = "./components/" + tag + "." + ext;
  if (ext !== "js")
    return fetch(resource)
      .then(response => response.text())
      .catch(_ => undefined);
  const exported = await import(resource).catch(_ => undefined);
  if (!exported) return undefined;
  if (exported.default) return exported.default;
  console.error(tag + ".js should have a default export class");
  return undefined;
}

// given a custom element: load from server, cache it, instantiate it,
async function loadAndInstantiateComponent(element: Element): Promise<ComponentInstance> {
  element.setAttribute("component", "");
  let definition = filesCache.get(element.tagName);

  if (!definition) {
    definition = {} as ComponentDefinition;
    filesCache.set(element.tagName, definition);
    definition.loading = Promise.all([
      getFile(element.tagName, "html").then(fc => (definition!.html = fc)),
      getFile(element.tagName, "css").then(fc => (definition!.css = fc)),
      getFile(element.tagName, "js").then(fc => (definition!.js = fc as any))
    ]).then(r => (definition!.loading = undefined));
  }

  if (definition.loading) await definition.loading;

  const componentInstance: ComponentInstance = {
    definition: definition,
    element: element as ElementWithController,
  };

  if (definition.css) {
    const style = document.createElement("style");
    style.innerHTML = definition.css as string;
    document.head!.appendChild(style);
  }

  if (definition.js) {
    try {
      const ctrl = new definition.js(componentInstance);
      componentInstance.controller = ctrl;
      componentInstance.element.uifComponent = componentInstance; // backlink for re-render
      if (!definition.controllerMembers) definition.controllerMembers = getMembers(ctrl);
      if (!definition.substitutions) definition.substitutions = definition.controllerMembers.map(key => new Substitution(key, ctrl));
    } catch (e) {
      console.error(element.tagName.toLowerCase(), "controller ctor threw", e);
    }
  }

  if (definition.html) {
    componentInstance.originalInnerHTML = element.innerHTML;
    render(componentInstance);
    await browserToParseHTML();

    // remember validator functions on which elements, remove initialization step stuff
    const valFunctionNames = (definition.controllerMembers || []).filter(each => each.startsWith("must")).concat(namesOfStandardValidators);
    Array.from(element.querySelectorAll("[uifValidatee]")).forEach((elementWithValidators: ElementWithValidators) => {
      elementWithValidators.removeAttribute("uifValidatee");
      elementWithValidators.uifValidators = Array.from(elementWithValidators.attributes)
        .filter(attr => attr.name.startsWith("initmust"))
        .map(attr => {
          elementWithValidators.removeAttribute(attr.name);
          const valFnNameWithoutInitPrefix = attr.name.slice(4);
          const valFnName = valFunctionNames.find(f => f.toLowerCase() === valFnNameWithoutInitPrefix);
          if (!valFnName) console.error("Undefined validation function", valFnNameWithoutInitPrefix, " Options were", valFunctionNames.join(", "));
          return valFnName || "";
        })
        .filter(name => !!name);
    });
  }

  return componentInstance;
}

function render(component: ComponentInstance): void {
  let html = component.definition.html as string;
  if (component.originalInnerHTML)
    html = html.replace(innerHtmlRegex, component.originalInnerHTML);
  if (component.controller && component.definition.substitutions)
    for (const sub of component.definition.substitutions)
      for (let found = html.match(sub.regex); found; found = html.match(sub.regex))
        switch (sub.type) {
          case SubstitutionTypes.Property:
            html = html.replace(sub.regex, component.controller[sub.key]);
            break;
          case SubstitutionTypes.MethodInvocation:
            const methodParameters = JSON.parse(`[${found[2] || ""}]`);
            const val = (component.controller[sub.key] as Function).apply(component.controller, methodParameters);
            html = html.replace(sub.regex, val);
            break;
          case SubstitutionTypes.EventHandler:
            const handlerParameters = found[2] ? `, ${found[2]}` : "";
            html = html.replace(sub.regex, ` ${sub.eventType}="uif.handle(this, event, '${sub.key}'${handlerParameters})"`);
            break;
          case SubstitutionTypes.Validator:
            html = html.replace(sub.regex, ` uifValidatee init${sub.key} onChange="uif.validate(this, event)"`);
            break;
        }
  component.element.innerHTML = html;
}

async function scan(element: Element): Promise<any> {
  if (!standardTags[element.tagName]) await loadAndInstantiateComponent(element);
  const childs = Array.from(element.children).map(scan);
  return Promise.all(childs);
}

// go ///////////

browserToParseHTML(1).then(_ => scan(document.body));
