# uif
a toy UI framework

## Concepts

* Unknown HTML tags are assumed to be custom, so the library requests the .js .html and .css files with the tag as the filename. 
* The .js file is assumed to be a module with a default export class which is the controller for the component.
* Event handlers in the controller are always named with the event name as the prefix if not the whole name.
* Event handlers in the HTML are just listed bare.  
* Validation functions have a standard function signature.
* Show/hide validation error messages with pure CSS. Javascript will set valid/invalid attributes.

There's a couple methods of displaying validation messages.  One is the summary block, usually after the form.  One is showing each validation message near the offending field.  But a field can have multiple validators, so can fail multiple validators simultaneously.  So even the "each per field" is also a partial summary.  

Also, the error messages themselves may be written into the HTML or returned by the validators themselves.  Seems odd to write "This is required" a hundred times throughout the codebase where a single dumping ground per field for all messages would be more concise, but also odd for one-off, highly specific messages to not be in HTML. 

Where to place validation messages could be immediately after the `input` but that assumption is easily broken.  Some sort of container for the purpose usually exists.

Dumping ground for summaries can be `<err/>`.  Or `<err for="field" />` or `<err for="wholeform" />` or `<err for="mustBeVegetable">asdf</err>`.  Sometimes we only want to show the user one error not all of them.

The difference between `<mustBeVegetable/>` and `<mustBeVegetable>Not a veggie</mustBeVegetable>` is the expectation that the validator will return the message. The HTML message is shown if both are provided.  (In this case the framework must add a permanent CSS class like `validation-message` to each of these pseudo-components so the user can style them with `.validation-message { ... }` rule.)

If a `<err />` component is used, then users can style with a `err { ... }` rule. 

Instead of `display:none` can we use `scale:0` and `scale:1` or whatever the `<if>` uses to animate on/off? 

## Experimental Idea

If `mustBeVeggie` is a validation function, and you want its message wrapped in an auto-created `<mustBeVeggie>` component, then can we genericize this into a function component, where any controller method could potentially be a one-off component? Any innerHTML could use substitutions same as anywhere. 

If the return value of said function-component is typeof boolean or number, the truthy/falsy return value toggles `display:none`.  Typeof string inverts truthy/falsy.  (Otherwise it's no different from just `{mustBeVeggie}`?) 

But now I'm evaluating the validator fns twice, once for real and once to show/hide the pseudo-component.


## Done

* The HTML tag name is also the filename of the js, css, and html which implement it. 
* All 3 files are optional. They're requested anyway and any 404s are ignored because toy.
* It only loads components as it hits them in the HTML. Preloading some would be more performant.
* The controller in the js file is the default export. You don't even need to name the class, just write `export default class {` and implement.
* Said default exported class is called the controller.
* HTML template uses single braces to delimit substitutions. The possible substitutions are restricted to the controller's own properties. So, `{propname}` or `{methodcall(arg,arg)}` only. 
* You can put content between the opening and closing tags, to be inserted where `{innerHTML}` appears in the enclosing component's template.
* Event handler code is always in the controller, and the name is restricted to beginning with the event's name.  So `onClick`, `onClickEdit`, `onClickOpen` are all valid names for an onClick handler.
* Event handlers are wired to events merely by listing the method name: `<button onClickEdit />`.  It's more succint than `<button onClick={onClickEdit} />` which doesn't add anything other than escaping a resonable naming convention.  Note that event handler methods, as attributes, aren't surrounded by curly braces like other substitutions.
* Form field validation methods must begin with `must`, accept the value as the first argument and the form as the second argument, and return `boolean | Promise<boolean>`. 
* Validation methods are placed on an element without decoration: `<input type=text mustBeVegetable />`.  Their attribute will be removed on render, but replaced if that validation method fails.  Also will appear attributes `invalid` or `valid` or `validating` on the same element.
* The `must` functions do not need to be put directly on the `input` element.  When placed on a non-input element like `div` it will find the input element within the element its placed on. This is assumed to be the common case, being placed on an element that wraps both input and styled error message so they can both use pure CSS to hide/show help text.  All validation attributes will appear on the wrapper element, not the contained input element. 

## ToDo 

* Failed validations appear in a controller property called `errors`.  It's falsy if no errors.
* If a `must` function is placed on an element with multiple input elements within it, the values of all of them are placed into an (object? array?) and passed to the function.
* `must` functions can be placed on the `<form>` element.  Cross-field validations can obviously go here, but they could also go on the dependent field as well.  `must` functions need not be pure functions.
* Anything that accepts a `must` function can accept attributes `validateOnBlur` or `validateOnChange` which determines how often the validation functions are called to update `errors`. This can be set in uif's global config and then overridden on a case-by-case basis.
* (When is mapping done?  I.e. changing string to Date, for instance.  Before `must` functions are ran. `mapX` functions perhaps? `parseX` and `stringifyX` for both directions? `inX` and `outX` even though which is which? `toX` and `fromX` then, like `toDate` and `fromDate`?) 
* If statements aren't done like any of the major frameworks.  It's a component, `<if>`, which easily accepts CSS transitions.  Unlike Angular & Vue it won't get lost among other attributes, and unlike React it won't much interfere with pure HTML/CSS staff on the project.  The `<if>` component itself always appears in the DOM even when false. Only its contents disappear.  
*  `<for-each varname={aggregateProp} indexvarname='index'>` creates temporary controller properties `varname` and `indexvarname` during its render.  Notice `index` is just a string literal. If `aggregateProp` holds an array, a `for..of` is performed.  If `aggregateProp` is an object, `for..in` is performed, returning `aggregateProp[indexvarname]` (`indexvarname` holds the property name instead of a number).  If `aggregateProp` is a number, a `for(let i = 0; i < aggregateProp; i++)` is performed.
* `<do-while varname={condition}>` is also available.

## Try it out

After git cloning and `npm install`, just `npm run compile` and either `npm run https` (Chrome) or `npm run http` (Firefox).  Bring up the F12 console in the browser to look around. 
