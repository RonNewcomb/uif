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
    uifVal: (inputElement: ElementWithValue, component: ComponentInstance, form: any, ...valFunctionNames: (keyof ValidatingController)[]) => void;
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

// useful at runtime

const protobj = Object.getPrototypeOf(new Object());
function getMembers(obj: object) {
  const p: string[] = [];
  for (; obj && obj != protobj; obj = Object.getPrototypeOf(obj)) {
    const op: string[] = Object.getOwnPropertyNames(obj);
    for (let i = 0; i < op.length; i++) if (p.indexOf(op[i]) == -1) p.push(op[i]);
  }
  return p;
}

window.uifVal = async (inputElement: ElementWithValue, component: ComponentInstance, form: any) => {
  const valFunctionNamesLowercased = Array.from(inputElement.attributes)
    .map(el => el.name)
    .filter(n => n.startsWith("must"));
  if (!component || !component.controller) {
    console.error("Component lacks .js controller on which to put validator functions like", valFunctionNamesLowercased.join(", "));
    return;
  }
  const valFunctionNames = getMembers(component.controller).filter(each => each.startsWith("must")); // TODO cache
  console.log("uifVal", inputElement, component, form, valFunctionNamesLowercased);
  const val = inputElement.value;
  for (const valFnNameLowercased of valFunctionNamesLowercased) {
    const valFnName = valFunctionNames.find(f => f.toLowerCase() === valFnNameLowercased);
    if (!valFnName) {
      console.error("Undefined validation function", valFnNameLowercased, "Options were", valFunctionNames.map(f => f.toLowerCase()).join(", "));
      return;
    }
    const valFn = component.controller[valFnName];
    const result = valFn(val, form);
    if (!(result instanceof Promise)) {
      setClearErr(inputElement, valFnName, result);
    } else {
      inputElement.setAttribute("validating", "");
      result.then(r => setClearErr(inputElement, valFnName, r));
    }
  }
};

function setClearErr(el: Element, valFnName: string | number, result: boolean) {
  if (!result) setValError(el, valFnName);
  else clearValError(el, valFnName);
}
function clearValError(el: Element, valFnName: string | number) {
  el.removeAttribute(valFnName.toString());
}
function setValError(el: Element, valFnName: string | number) {
  el.setAttribute(valFnName.toString(), "");
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
            const parameterList = found[2] ? `${found[2]},` : "";
            html = html.replace(sub.regex, ` ${sub.key}="" onChange="uifVal(this,closest('[component]'),closest('form'))"`);
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
