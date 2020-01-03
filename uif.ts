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
  regex: RegExp;

  constructor(key: string) {
    this.propertyName = key;
    this.regex = new RegExp(`{${key}}`, "g");
  }
}

interface ComponentInstance {
  definition: ComponentDefinition;
  element: ElementWithController;
  children?: ComponentInstance[]; // basically @ViewChildren(), so only custom components which are direct children of this custom component
  controller?: Controller;
  substitutions: Substitution[]; // cache
}

export interface EventHandler {
  (event: Event, element: Element): void;
}

// pretty up the browser

declare global {
  interface Array<T> {
    splitFilter(fn: (value: T) => boolean): { yes: T[]; no: T[] };
  }
  interface HTMLCollectionBase {
    map<U>(callbackfn: (value: Element) => U, thisArg?: any): U[];
    filter(callbackfn: (value: Element) => boolean, thisArg?: any): Element[];
    reduce<U>(callbackfn: (previousValue: U, currentValue: Element) => U, initialValue: U): U;
    splitFilter(fn: (value: Element) => boolean): { yes: Element[]; no: Element[] };
  }
}
Array.prototype.splitFilter = function splitFilter<T>(this: Array<T>, fn: (value: T) => boolean): { yes: T[]; no: T[] } {
  const retval = { yes: [] as T[], no: [] as T[] };
  for (const item of this) {
    const whichList = fn(item) ? retval.yes : retval.no;
    whichList.push(item);
  }
  return retval;
};
HTMLCollection.prototype.map = Array.prototype.map;
HTMLCollection.prototype.filter = Array.prototype.filter;
HTMLCollection.prototype.reduce = Array.prototype.reduce;
HTMLCollection.prototype.splitFilter = Array.prototype.splitFilter;

// static data ///////////

const surroundTag = "INNERHTML";
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
      element.controller = componentInstance.controller = new definition.js(componentInstance);
      componentInstance.substitutions = Object.keys(componentInstance.controller).map(key => new Substitution(key));
    } catch (e) {
      console.error(element.tagName.toLowerCase(), "controller ctor threw", e);
    }
  }

  if (definition.html) {
    const oldContent = element.innerHTML;
    element.innerHTML = substitutions(definition.html as string, componentInstance);

    if (oldContent) {
      await browserToParseHTML();
      element.getElementsByTagName(surroundTag).map(each => (each.outerHTML = oldContent));
    }

    await browserToParseHTML();
    componentInstance.children = await scan(element);
  }

  return componentInstance;
}

function substitutions(html: string, component: ComponentInstance): string {
  for (const sub of component.substitutions) html = html.replace(sub.regex, component.controller![sub.propertyName]);
  return html;
}

// scans the direct children of the passed-in HtmlElement for custom components.
// children which aren't simply have their grandchildren scanned, recursively.
// children which are are instantiated, loaded first if needed.
async function scan(parentElement: Element): Promise<ComponentInstance[]> {
  const { yes, no } = parentElement.children.splitFilter(element => standardTags[element.tagName]);
  const loadingAndInstantiatingComponents = no.map(loadAndInstantiateComponent);
  yes.forEach(scan);
  return Promise.all(loadingAndInstantiatingComponents);
}

// go ///////////

scan(document.body);
