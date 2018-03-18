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
const standardCustomTags = ['IF', 'EACH'];
const standardTags = ['DIV', 'P', 'SPAN', 'SCRIPT', 'B', 'I', 'A', 'UL', 'LI', surroundTag].concat(standardCustomTags);
const standardExtentions = ["html", "css", "js"];

let definitions = new Map<TagName, ComponentDefinition>();

// Promisify //////

let getFile = (tag: TagName, ext: FileExtension) => new Promise<FileContents>(resolve => {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "http://localhost/uif/components/" + tag + "." + ext);
    xhr.onload = () => resolve((xhr.status >= 200 && xhr.status < 300) ? xhr.response : void 0);
    xhr.send();
});

let browserToParseHTML = () => new Promise(r => setTimeout(r));

// scan, load, instantiate ///////

function getTagsWithin(elements: HTMLCollection): Element[] {
    let customElements = [] as Element[];
    for (let i = 0; i < elements.length; i++) // can't use anything but long-form loop
        if (standardTags.indexOf(elements[i].tagName) === -1)
            customElements.push(elements[i]);
    return customElements;
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
            let contentElement = component.location.getElementsByTagName(surroundTag);
            if (contentElement && contentElement.length > 0) {
                for (let i = 0; i < contentElement.length; i++)
                    contentElement[i].outerHTML = content;
                await browserToParseHTML();
            }
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
