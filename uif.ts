// internal types ////////

interface TagName extends String { }
interface FileContents extends String { }
interface FileExtension extends String { }

interface ComponentDefinition {
    css: FileContents;
    html: FileContents;
    js: FileContents;
}

interface ComponentToCreate {
    definition: ComponentDefinition;
    location: HTMLElement;
}

interface ComponentInstance {
}

// static data ///////////

const surroundTag = 'INNERHTML';
const standardCustomTags = ['IF', 'EACH', surroundTag];
const standardTags = ["A", "ABBR", "ACRONYM", "ADDRESS", "APPLET", "AREA", "ARTICLE", "ASIDE", "AUDIO", "B", "BASE", "BASEFONT", "BDO", "BIG", "BLOCKQUOTE", "BODY", "BR", "BUTTON", "CANVAS", "CAPTION", "CENTER", "CITE", "CODE", "COL", "COLGROUP", "DATA", "DATALIST", "DD", "DEL", "DFN", "DIR", "DIV", "DL", "DT", "EM", "EMBED", "FIELDSET", "FIGCAPTION", "FIGURE", "FONT", "FOOTER", "FORM", "FRAME", "FRAMESET", "H1", "H2", "H3", "H4", "H5", "H6", "HEAD", "HEADER", "HGROUP", "HR", "HTML", "I", "IFRAME", "IMG", "INPUT", "INS", "ISINDEX", "KBD", "KEYGEN", "LABEL", "LEGEND", "LI", "LINK", "LISTING", "MAP", "MARK", "MARQUEE", "MENU", "META", "METER", "NAV", "NEXTID", "NOBR", "NOFRAMES", "NOSCRIPT", "OBJECT", "OL", "OPTGROUP", "OPTION", "OUTPUT", "P", "PARAM", "PICTURE", "PLAINTEXT", "PRE", "PROGRESS", "Q", "RT", "RUBY", "S", "SAMP", "SCRIPT", "SECTION", "SELECT", "SMALL", "SOURCE", "SPAN", "STRIKE", "STRONG", "STYLE", "SUB", "SUP", "TABLE", "TBODY", "TD", "TEMPLATE", "TEXTAREA", "TFOOT", "TH", "THEAD", "TIME", "TITLE", "TR", "TRACK", "TT", "U", "UL", "VAR", "VIDEO", "WBR", "X-MS-WEBVIEW", "XMP"];
const defaultTags = standardTags.concat(standardCustomTags);
const standardExtentions = ["html", "css", "js"];

let definitions = new Map<TagName, ComponentDefinition>();

// Promisify so we can async/await //////

let getFile = (tag: TagName, ext: FileExtension) => new Promise<FileContents>(resolve => {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "http://localhost/uif/components/" + tag + "." + ext);
    xhr.onload = () => resolve((xhr.status >= 200 && xhr.status < 300) ? xhr.response : "");
    xhr.send();
});

let browserToParseHTML = () => new Promise(r => setTimeout(r));

// scan, load, instantiate ///////

function getTagsWithin(elements: HTMLCollection): Element[] {
    return Array.from(elements).filter(e => !defaultTags.includes(e.tagName));
}

async function loadComponent(tag: TagName): Promise<ComponentDefinition> {
    if (definitions.has(tag))
        return definitions.get(tag);
    definitions.set(tag, {} as ComponentDefinition);
    return Promise.all(standardExtentions.map(async ext => definitions.get(tag)[ext] = await getFile(tag, ext)))
        .then(_ => definitions.get(tag));
}

async function instantiateComponent(component: ComponentToCreate): Promise<ComponentInstance> {

    if (component.definition.css) {
        let style = document.createElement('style');
        style.innerHTML = component.definition.css as string;
        document.head.appendChild(style);
    }

    if (component.definition.js) {
        let script = document.createElement('script');
        script.innerHTML = component.definition.js as string;
        document.body.appendChild(script);
    }

    if (component.definition.html) {
        let content = component.location.innerHTML;
        component.location.innerHTML = component.definition.html as string;
        await browserToParseHTML();

        if (content) {
            (Array.from(component.location.getElementsByTagName(surroundTag)) || []).forEach(e => e.outerHTML = content);
            await browserToParseHTML();
        }
        return scanLoadAndInstantiate(component.location);
    }
    return component as ComponentInstance;
}

async function scanLoadAndInstantiate(customElement: Element): Promise<ComponentInstance[]> {
    return Promise.all(
        getTagsWithin(customElement.children)
            .map(async element => <ComponentToCreate>{ definition: await loadComponent(element.tagName.toLowerCase()), location: await element })
            .map(async component2Create => instantiateComponent(await component2Create))
    );
}

// go ///////////

window.onload = _ => scanLoadAndInstantiate(document.body);
