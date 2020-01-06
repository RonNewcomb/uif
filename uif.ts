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

interface TagName extends String {}
interface FileContents extends String {}
interface FileExtension extends String {}
interface ControllerCtor {
  new (instance?: ComponentInstance): Controller;
}
interface Dictionary<T = any> {
  [key: string]: T;
}
interface Controller extends ControllerCtor, Dictionary<any> {}

interface ValidationFn {
  (val: any, form: any): boolean | Promise<boolean>;
}
interface ValErrorsController {
  errors?: ArrayKeys<Dictionary<string>>;
}
interface ValidatingController extends Dictionary<ValidationFn> /*,ValErrorsController */ {}

type ElementWithController = Element & { controller?: Controller };
type ElementWithValidators = Element & { uifValidators: string[] };
type ElementWithValue = Element & { value: string; name?: string };
type ArrayKeys<T> = Array<T> & Dictionary<T>;

interface ComponentDefinition {
  css: FileContents | undefined;
  html: FileContents | undefined;
  js: ControllerCtor | undefined;
  loading?: Promise<any>;
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
  substitutions: Substitution[]; // cache
}

export interface EventHandler {
  (event: Event, element: Element): void;
}

declare global {
  interface Window {
    uifVal: (inputElement: ElementWithValidators, event: Event) => void;
  }
}

// static data ///////////

const innerHtmlRegex = new RegExp(`{innerHTML}`, "g");
const inputFormFields = ["TEXTAREA", "INPUT", "SELECT"];
const filesCache = new Map<TagName, ComponentDefinition>();
const browserToParseHTML = () => new Promise(r => setTimeout(r));
const eventTypes = Object.keys(window)
  .filter(k => k.startsWith("on"))
  .sort((a, b) => b.length - a.length);

// setup ///////////////

const RegexPerSubType: Map<SubstitutionTypes, (key: string) => RegExp> = new Map([
  [SubstitutionTypes.MethodInvocation, key => new RegExp(`{(${key})\\(([^)]*)\\)}`)],
  [SubstitutionTypes.EventHandler, key => new RegExp(`\\s${key}(?!=)\\b(\\(([^)]*)\\))?`, "i")],
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

// runtime

const protobj = Object.getPrototypeOf(new Object());
function getMembers(obj: object) {
  const p: string[] = [];
  for (; obj && obj != protobj; obj = Object.getPrototypeOf(obj)) {
    const op: string[] = Object.getOwnPropertyNames(obj);
    for (let i = 0; i < op.length; i++) if (p.indexOf(op[i]) == -1) p.push(op[i]);
  }
  return p;
}

// form validation

window.uifVal = (wrapperElement: ElementWithValidators, event: Event) => {
  const inputElement = (event.target as any) as ElementWithValue;

  const componentElement = wrapperElement.closest("[component]") as ElementWithController;
  if (!componentElement) {
    console.error("Form input field on", wrapperElement, "is outside of uif-controlled DOM");
    return;
  }

  const ctrl = componentElement.controller;
  if (!ctrl) {
    console.error("Component lacks .js controller on which to put validator functions like", wrapperElement.uifValidators.join(", "));
    return;
  }

  const form = wrapperElement.closest("form");

  let reviewing = 0;
  let approvals = 0;
  let needsWorks = 0;
  for (const valFnName of wrapperElement.uifValidators) {
    const result = ctrl[valFnName](inputElement.value, form);
    if (!(result instanceof Promise)) {
      result ? approvals++ : needsWorks++;
      annotateElement(wrapperElement, valFnName, result);
    } else {
      reviewing++;
      result.catch(e => (e ? e.toString() : valFnName + " threw")).then(r => annotateElement(wrapperElement, valFnName, r, true));
    }
  }
  setReviewing(wrapperElement, reviewing);
  if (needsWorks > 0) setIsGood(wrapperElement, false);
  if (needsWorks === 0 && reviewing === 0) setIsGood(wrapperElement, true);
};

function annotateElement(el: Element, valFnName: string | number, result: boolean | string, decreaseReviewing: boolean = false) {
  if (!result) {
    el.setAttribute(valFnName.toString(), typeof result === "string" && result ? result : "");
    setIsGood(el, false);
  } else el.removeAttribute(valFnName.toString());
  if (decreaseReviewing) {
    const howManyLeft = setReviewing(el, -1);
    if (howManyLeft < 1) setIsGood(el, !el.hasAttribute("needsWork"));
  }
}

function setReviewing(el: Element, howMany: number) {
  if (howMany === -1) howMany = Number(el.getAttribute("reviewing") || "1") - 1;
  if (howMany === 0) el.removeAttribute("reviewing");
  else el.setAttribute("reviewing", howMany.toString());
  return howMany;
}

function setIsGood(el: Element, good: boolean) {
  if (good) {
    el.setAttribute("approval", "");
    el.removeAttribute("needsWork");
  } else {
    el.setAttribute("needsWork", "");
    el.removeAttribute("approval");
  }
}

// // set either onBlur / onChange to this. Transform the list of val* functions to onChange="uifVal(this, closest('[controller]'), val*)"
// const uifVal = async (wrapperElement: ElementWithValue, ctrl: ValidatingController, form: any, ...rest: (keyof ValidatingController)[]) => {
//   const fields: ElementWithValue[] = inputFormFields.includes(wrapperElement.tagName) ? [wrapperElement] : Array.from(wrapperElement.querySelectorAll(inputFormFields.join(",")));
//   const val = fields.reduce<ArrayKeys<string>>((retval, f) => {
//     retval.push(f.value);
//     if (f.name) retval[f.name] = f.value;
//     return retval;
//   }, [] as any);
//   const results:{ result: string|boolean, name:}[] = [];
//   const gettingResults = rest.map(key => ctrl[key](val, form)).map(result => Promise.resolve(result));
//   const results = await Promise.all(gettingResults);
//   if (results.every(r => (typeof r === "string" ? r === "" : !!r))) {
//     (ctrl as ValErrorsController).errors = undefined;
//     return;
//   }

// };

// initialization

// load one file part (html/css/js) of a component and return file's contents as a string, or undefined if 404
async function getFile(tag: TagName, ext: FileExtension): Promise<FileContents | undefined> {
  tag = tag.toLowerCase();
  const resource = "./components/" + tag + "." + ext;
  if (ext !== "js")
    return fetch(resource)
      .then(response => response.text())
      .catch(_ => undefined);
  const exported = await SystemJS.import(resource).catch(_ => undefined);
  if (!exported) return undefined;
  if (exported.default) return exported.default;
  console.error(tag + ".js should have a default export class");
  return undefined;
}

// given a custom element: load from server, cache it, instantiate it,
async function loadAndInstantiateComponent(element: ElementWithController): Promise<ComponentInstance> {
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
    element: element,
    substitutions: []
  };

  if (definition.css) {
    const style = document.createElement("style");
    style.innerHTML = definition.css as string;
    document.head!.appendChild(style);
  }

  if (definition.js) {
    try {
      const ctrl = new definition.js(componentInstance);
      element.controller = ctrl;
      componentInstance.controller = ctrl;
      componentInstance.substitutions = getMembers(ctrl).map(key => new Substitution(key, ctrl));
    } catch (e) {
      console.error(element.tagName.toLowerCase(), "controller ctor threw", e);
    }
  }

  if (definition.html) {
    let rendered = definition.html as string;
    const valueOfInnerHtmlParameter = element.innerHTML;
    if (valueOfInnerHtmlParameter) rendered = rendered.replace(innerHtmlRegex, valueOfInnerHtmlParameter);
    element.innerHTML = substitutions(rendered, componentInstance);
    await browserToParseHTML();

    // remember validator functions on which elements, remove initialization step stuff
    const elements = element.querySelectorAll("[uifValidatee]");
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i] as ElementWithValidators;
      const componentElement = el.closest("[component]") as ElementWithController;
      if (!componentElement) {
        console.error("Form input field on", el, "is outside of uif-controlled DOM");
        continue;
      }
      const ctrl = componentElement.controller;
      if (!ctrl) {
        console.error("Component lacks .js controller on which to put validator functions like", el.uifValidators.join(", "));
        continue;
      }
      const valFunctionNames = getMembers(ctrl).filter(each => each.startsWith("must")); // TODO cache
      el.removeAttribute("uifValidatee");
      el.uifValidators = Array.from(el.attributes)
        .filter(attr => attr.name.startsWith("initmust"))
        .map(attr => {
          el.removeAttribute(attr.name);
          const valFnNameLowercased = attr.name.slice(4);
          const valFnName = valFunctionNames.find(f => f.toLowerCase() === valFnNameLowercased);
          if (!valFnName) console.error("Undefined validation function", valFnNameLowercased, "Options were", valFunctionNames.map(f => f.toLowerCase()).join(", "));
          return valFnName || "";
        })
        .filter(name => !!name);
    }
  }

  return componentInstance;
}

function substitutions(html: string, component: ComponentInstance): string {
  if (component.controller)
    for (const sub of component.substitutions) {
      switch (sub.type) {
        case SubstitutionTypes.Property:
          html = html.replace(sub.regex, component.controller[sub.key]);
          break;
        case SubstitutionTypes.MethodInvocation:
          for (let found = html.match(sub.regex); found; found = html.match(sub.regex)) {
            const parameterList = JSON.parse(`[${found[2] || ""}]`);
            const val = (component.controller[sub.key] as Function).apply(component.controller, parameterList);
            html = html.replace(sub.regex, val);
          }
          break;
        case SubstitutionTypes.EventHandler:
          for (let found = html.match(sub.regex); found; found = html.match(sub.regex)) {
            const parameterList = found[2] ? `${found[2]},` : "";
            html = html.replace(sub.regex, ` ${sub.eventType}="closest('[component]').controller.${sub.key}(${parameterList}event,this)"`);
          }
          break;
        case SubstitutionTypes.Validator:
          for (let found = html.match(sub.regex); found; found = html.match(sub.regex)) {
            html = html.replace(sub.regex, ` uifValidatee init${sub.key} onChange="uifVal(this, event)"`);
          }
          break;
      }
    }
  return html;
}

async function scan(element: Element): Promise<any> {
  if (!standardTags[element.tagName]) await loadAndInstantiateComponent(element);
  const childs = Array.from(element.children).map(scan);
  return Promise.all(childs);
}

// go ///////////

scan(document.body);
