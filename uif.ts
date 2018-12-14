
// internal types ////////

interface TagName extends String { }
interface FileContents extends String { }
interface FileExtension extends String { }
interface ControllerCtor {
    new(instance?: ComponentInstance): Controller;
}
interface Controller extends Object, ControllerCtor {
}

type ElementWithController = Element & { controller?: Controller };

interface ComponentDefinition {
    css: FileContents | undefined;
    html: FileContents | undefined;
    js: ControllerCtor | undefined;
}

interface ComponentInstance {
    definition: ComponentDefinition;
    element: ElementWithController;
    children?: ComponentInstance[];
    controller?: Controller;
}

export interface EventHandler {
    (/*...rest:any[],*/ event: Event, element: Element): void;
}

// static data ///////////

const surroundTag = 'INNERHTML';
const standardCustomTags = ['if', 'each', surroundTag];
const standardTags = ["a", "abbr", "acronym", "address", "applet", "area", "article", "aside", "audio", "b", "base", "basefont", "bdo", "big", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "data", "datalist", "dd", "del", "dfn", "dir", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure", "font", "footer", "form", "frame", "frameset", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "iframe", "img", "input", "ins", "isindex", "kbd", "keygen", "label", "legend", "li", "link", "listing", "map", "mark", "marquee", "menu", "meta", "meter", "nav", "nextid", "nobr", "noframes", "noscript", "object", "ol", "optgroup", "option", "output", "p", "param", "picture", "plaintext", "pre", "progress", "q", "rt", "ruby", "s", "samp", "script", "section", "select", "small", "source", "span", "strike", "strong", "style", "sub", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "tt", "u", "ul", "var", "video", "wbr", "x-ms-webview", "xmp"];
const defaultTags = standardTags.concat(standardCustomTags);
const standardExtentions: (keyof ComponentDefinition)[] = ["html", "css", "js"];

export let definitions = new Map<TagName, ComponentDefinition>();

// Promisify so we can async/await //////

async function getFile(tag: TagName, ext: FileExtension): Promise<FileContents | undefined> {
    let resource = "components/" + tag + "." + ext;
    if (ext === "js") {
        let exported = await SystemJS.import("./" + resource).catch(_ => undefined);
        if (!exported) return undefined;
        if (exported.default) return exported.default;
        let validIdentifer = tag.replace(/-|\./g, '');
        if (exported[validIdentifer]) return exported[validIdentifer];
        console.error(tag + ".js should have an exported controller class.  Either the class is missing, isn't exported as the default, or isn't exported as", validIdentifer);
        return undefined;
    }
    return new Promise<FileContents>(resolve => {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", window.location.href + resource);
        xhr.onload = () => resolve((xhr.status >= 200 && xhr.status < 300) ? xhr.response : "");
        xhr.send();
    });
}

let browserToParseHTML = () => new Promise(r => setTimeout(r));

// scan, load, instantiate ///////

async function scanLoadAndInstantiate(parentElement: Element): Promise<ComponentInstance[]> {
    let instantiating: Promise<ComponentInstance>[] = [];
    for (var i = 0; i < parentElement.children.length; i++) {
        let element: ElementWithController = parentElement.children[i];
        let tag: TagName = element.tagName.toLowerCase();

        if (defaultTags.includes(tag as string)) {
            scanLoadAndInstantiate(element); // check descendents of div, span, etc. but don't send them on to the next step
            continue;
        }

        let componentInstance = loadAndInstantiate(tag, element);
        instantiating.push(componentInstance);
    }
    return Promise.all(instantiating);
}

async function loadAndInstantiate(tag: TagName, element: ElementWithController): Promise<ComponentInstance> {
    let definition: ComponentDefinition | undefined = definitions.get(tag);

    if (!definition) {
        definition = {} as ComponentDefinition;
        definitions.set(tag, definition);
        let loadingFiles = standardExtentions.map(ext => getFile(tag, ext).then(fc => (<any>definition)[ext as string] = fc));
        await Promise.all(loadingFiles);
    }

    let componentInstance: ComponentInstance = {
        definition: definition,
        element: element,
    };

    if (definition.css) {
        let style = document.createElement('style');
        style.innerHTML = definition.css as string;
        document.head!.appendChild(style);
    }

    if (definition.js) {
        try {
            element.controller = componentInstance.controller = new definition.js(componentInstance);
        }
        catch (e) {
            console.error(tag, "controller ctor threw", e);
        }
    }

    if (definition.html) {
        let oldContent = element.innerHTML;
        element.innerHTML = definition.html as string;

        if (oldContent) {
            await browserToParseHTML();
            let placeContentHeres = Array.from(element.getElementsByTagName(surroundTag));
            if (placeContentHeres)
                placeContentHeres.forEach(e => e.outerHTML = oldContent);
        }

        await browserToParseHTML();
        let instances = await scanLoadAndInstantiate(element);
        componentInstance.children = instances;
    }

    return componentInstance;
}

// go ///////////

//window.onload = () => scanLoadAndInstantiate(document.body);

// Object.keys(window).forEach(key => {
//     if (/^on/.test(key)) {
//         window.addEventListener(key.slice(2), event => {
//             console.log(event);
//         });
//     }
// });
scanLoadAndInstantiate(document.body);
