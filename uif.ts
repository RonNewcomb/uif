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

// internal types ////////

interface TagName extends String {}
interface FileContents extends String {}
interface FileExtension extends String {}
interface ControllerCtor {
  new (instance?: ComponentInstance): Controller;
}
interface Dictionary {
  [key: string]: any;
}
interface Controller extends ControllerCtor, Dictionary {}

type ElementWithController = Element & { controller?: Controller };

interface ComponentDefinition {
  css: FileContents | undefined;
  html: FileContents | undefined;
  js: ControllerCtor | undefined;
  loading?: Promise<any>;
}

class Substitution {
  propertyName: string;
  isFunction: boolean;
  regex: RegExp;

  constructor(key: string, ctrl: Controller) {
    this.propertyName = key;
    this.isFunction = typeof ctrl[key] === "function";
    this.regex = this.isFunction ? new RegExp(`{(${key})\\(([^)]*)\\)}`) : new RegExp(`{${key}}`, "g");
  }
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

// static data ///////////

const innerHtmlRegex = new RegExp(`{innerHTML}`, "g");
const filesCache = new Map<TagName, ComponentDefinition>();
const browserToParseHTML = () => new Promise(r => setTimeout(r));

// load one file part (html/css/js) of a component and return file's contents as a string, or undefined if 404
async function getFile(tag: TagName, ext: FileExtension): Promise<FileContents | undefined> {
  tag = tag.toLowerCase();
  const resource = "./components/" + tag + "." + ext;
  if (ext !== "js") return fetch(resource).then(response => response.text());
  const exported = await SystemJS.import(resource).catch(_ => undefined);
  if (!exported) return undefined;
  if (exported.default) return exported.default;
  const validIdentifer = tag.replace(/-|\./g, "");
  if (exported[validIdentifer]) return exported[validIdentifer];
  console.error(tag + ".js should have an exported controller class.  Either the class is missing, isn't exported as the default, or isn't exported as", validIdentifer);
  return undefined;
}

// given a custom element: load from server, cache it, instantiate it,
async function loadAndInstantiateComponent(element: ElementWithController): Promise<ComponentInstance> {
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
  if (!component.controller) return html;
  for (const sub of component.substitutions) {
    if (sub.isFunction) {
      for (let found = html.match(sub.regex); found; found = html.match(sub.regex)) {
        const functionName = found[1];
        const parameterList = JSON.parse("[" + (found[2] || "") + "]");
        const val = (component.controller[functionName] as Function).apply(component.controller, parameterList);
        html = html.replace(sub.regex, val);
      }
    } else {
      html = html.replace(sub.regex, component.controller[sub.propertyName]);
    }
  }
  return html;
}

const protobj = Object.getPrototypeOf(new Object());
function getMembers(obj: object) {
  const p: string[] = [];
  for (; obj && obj != protobj; obj = Object.getPrototypeOf(obj)) {
    const op: string[] = Object.getOwnPropertyNames(obj);
    for (let i = 0; i < op.length; i++) if (p.indexOf(op[i]) == -1) p.push(op[i]);
  }
  return p;
}

async function scan(element: Element): Promise<any> {
  if (!standardTags[element.tagName]) await loadAndInstantiateComponent(element);
  const childs = Array.from(element.children).map(scan);
  return Promise.all(childs);
}

// go ///////////

scan(document.body);
