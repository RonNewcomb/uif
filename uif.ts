// internal types ////////

interface TagName extends String {}
interface FileContents extends String {}
interface FileExtension extends String {}
interface ControllerCtor {
  new (instance?: ComponentInstance): Controller;
}
interface Controller extends Object, ControllerCtor {}

type ElementWithController = Element & { controller?: Controller };

interface ComponentDefinition {
  css: FileContents | undefined;
  html: FileContents | undefined;
  js: ControllerCtor | undefined;
  loading?: Promise<(FileContents | undefined)[]>;
}

interface ComponentInstance {
  definition: ComponentDefinition;
  element: ElementWithController;
  children?: ComponentInstance[]; // basically @ViewChildren(), so only custom components which are direct children of this custom component
  controller?: Controller;
  substitutions: string[]; // cache
}

export interface EventHandler {
  (event: Event, element: Element): void;
}

// static data ///////////

const surroundTag = "INNERHTML";
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
  sum[cur] = true;
  return sum;
}, <{ [key: string]: boolean }>{});
const filesCache = new Map<TagName, ComponentDefinition>();

// Promisify so we can async/await //////

async function getFile(tag: TagName, ext: FileExtension): Promise<FileContents | undefined> {
  const resource = "./components/" + tag + "." + ext;
  if (ext === "js") {
    const exported = await SystemJS.import(resource).catch(_ => undefined);
    if (!exported) return undefined;
    if (exported.default) return exported.default;
    const validIdentifer = tag.replace(/-|\./g, "");
    if (exported[validIdentifer]) return exported[validIdentifer];
    console.error(tag + ".js should have an exported controller class.  Either the class is missing, isn't exported as the default, or isn't exported as", validIdentifer);
    return undefined;
  }
  return new Promise<FileContents>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", resource);
    xhr.onerror = reject;
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300 ? xhr.response : "");
    xhr.send();
  });
}

const browserToParseHTML = () => new Promise(r => setTimeout(r));

// scans the direct children of the passed-in HtmlElement for custom components. If any, recurses into them, and set the .children to what the recursion returns.
async function scanLoadAndInstantiate(parentElement: Element): Promise<ComponentInstance[]> {
  const instantiating: Promise<ComponentInstance>[] = [];
  for (var i = parentElement.children.length - 1; i >= 0; i--) {
    const element: ElementWithController = parentElement.children[i];
    const tag: TagName = element.tagName.toLowerCase();

    // check descendents of div, span, etc. but don't send them on to the next step;
    // we don't memorize the children of a div even if they are custom components
    if (standardTags[tag as string]) scanLoadAndInstantiate(element);
    else instantiating.push(loadAndInstantiateComponent(tag, element));
  }
  return Promise.all(instantiating);
}

// as a separate async function, this won't block the for-loop above
async function loadAndInstantiateComponent(tag: TagName, element: ElementWithController): Promise<ComponentInstance> {
  let definition: ComponentDefinition | undefined = filesCache.get(tag);

  if (!definition) {
    definition = {} as ComponentDefinition;
    filesCache.set(tag, definition);
    definition.loading = Promise.all([
      getFile(tag, "html").then(fc => (definition!.html = fc)),
      getFile(tag, "css").then(fc => (definition!.css = fc)),
      getFile(tag, "js").then(fc => (definition!.js = fc as any))
    ]).then(r => {
      definition!.loading = undefined;
      return r;
    });
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
      componentInstance.substitutions = Object.keys(componentInstance.controller);
    } catch (e) {
      console.error(tag, "controller ctor threw", e);
    }
  }

  if (definition.html) {
    const oldContent = element.innerHTML;
    element.innerHTML = substitutions(definition.html as string, componentInstance);

    if (oldContent) {
      await browserToParseHTML();
      const placeContentHeres = element.getElementsByTagName(surroundTag);
      for (var i = placeContentHeres.length - 1; i >= 0; i--) placeContentHeres[i].outerHTML = oldContent;
    }

    await browserToParseHTML();
    componentInstance.children = await scanLoadAndInstantiate(element);
  }

  return componentInstance;
}

function substitutions(html: string, component: ComponentInstance): string {
  for (const sub of component.substitutions) html = html.replace(new RegExp("{" + sub + "}", "g"), (component.controller as any)[sub]);
  return html;
}

// go ///////////

scanLoadAndInstantiate(document.body);
