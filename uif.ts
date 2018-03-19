
// internal types ////////

interface TagName extends String { }
interface FileContents extends String { }
interface FileExtension extends String { }

interface ComponentDefinition {
    css: FileContents;
    html: FileContents;
    js: FileContents;
}

interface ComponentInstance {
    definition: ComponentDefinition;
    element: Element;
    children: ComponentInstance[];
}

// static data ///////////

const surroundTag = 'INNERHTML';
const standardCustomTags = ['IF', 'EACH', surroundTag];
const standardTags = ["A", "ABBR", "ACRONYM", "ADDRESS", "APPLET", "AREA", "ARTICLE", "ASIDE", "AUDIO", "B", "BASE", "BASEFONT", "BDO", "BIG", "BLOCKQUOTE", "BODY", "BR", "BUTTON", "CANVAS", "CAPTION", "CENTER", "CITE", "CODE", "COL", "COLGROUP", "DATA", "DATALIST", "DD", "DEL", "DFN", "DIR", "DIV", "DL", "DT", "EM", "EMBED", "FIELDSET", "FIGCAPTION", "FIGURE", "FONT", "FOOTER", "FORM", "FRAME", "FRAMESET", "H1", "H2", "H3", "H4", "H5", "H6", "HEAD", "HEADER", "HGROUP", "HR", "HTML", "I", "IFRAME", "IMG", "INPUT", "INS", "ISINDEX", "KBD", "KEYGEN", "LABEL", "LEGEND", "LI", "LINK", "LISTING", "MAP", "MARK", "MARQUEE", "MENU", "META", "METER", "NAV", "NEXTID", "NOBR", "NOFRAMES", "NOSCRIPT", "OBJECT", "OL", "OPTGROUP", "OPTION", "OUTPUT", "P", "PARAM", "PICTURE", "PLAINTEXT", "PRE", "PROGRESS", "Q", "RT", "RUBY", "S", "SAMP", "SCRIPT", "SECTION", "SELECT", "SMALL", "SOURCE", "SPAN", "STRIKE", "STRONG", "STYLE", "SUB", "SUP", "TABLE", "TBODY", "TD", "TEMPLATE", "TEXTAREA", "TFOOT", "TH", "THEAD", "TIME", "TITLE", "TR", "TRACK", "TT", "U", "UL", "VAR", "VIDEO", "WBR", "X-MS-WEBVIEW", "XMP"];
const defaultTags = standardTags.concat(standardCustomTags);
const standardExtentions: (keyof ComponentDefinition)[] = ["html", "css", "js"];

let definitions = new Map<TagName, ComponentDefinition>();

// Promisify so we can async/await //////

function getFile(tag: TagName, ext: FileExtension): Promise<FileContents> {
    let resource = "/components/" + tag + "." + ext;
    if (ext === "js")
        return SystemJS.import("." + resource).catch(_ => "");
    return new Promise<FileContents>(resolve => {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "http://localhost/uif" + resource);
        xhr.onload = () => resolve((xhr.status >= 200 && xhr.status < 300) ? xhr.response : "");
        xhr.send();
    });
}

let browserToParseHTML = () => new Promise(r => setTimeout(r));

// scan, load, instantiate ///////

let scanLoadAndInstantiate = (parentElement: Element): Promise<ComponentInstance[]> => Promise.all(Array
    .from(parentElement.children)
    .filter(element => {
        let isCustom = !defaultTags.includes(element.tagName);
        if (!isCustom)
            scanLoadAndInstantiate(element); // check descendents of div, span, etc. but don't send them on to the next step
        return isCustom;
    })
    .map(async element => {
        let tag: string = element.tagName.toLowerCase();
        let definition: ComponentDefinition | undefined = definitions.get(tag);

        if (!definition) {
            definition = {} as ComponentDefinition;
            definitions.set(tag, definition);
            await Promise.all(standardExtentions.map(async ext => definition![ext] = await getFile(tag, ext)));
        }

        if (definition.css) {
            let style = document.createElement('style');
            style.innerHTML = definition.css as string;
            document.head.appendChild(style);
        }

        // if (definition.js) {
        //     let script = document.createElement('script');
        //     script.innerHTML = definition.js as string;
        //     document.body.appendChild(script);
        // }

        let componentInstance: ComponentInstance = {
            definition: definition,
            element: element,
            children: [] as ComponentInstance[],
        };

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
            scanLoadAndInstantiate(element).then(instances => componentInstance.children = instances);
        }

        return componentInstance;
    }));


// go ///////////

//window.onload = () => scanLoadAndInstantiate(document.body);
scanLoadAndInstantiate(document.body);
