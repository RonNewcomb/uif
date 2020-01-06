# uif
a toy UI framework

## Done

* The HTML tag name is also the filename of the js, css, and html which implement it. 
* All 3 files are optional. They're requested anyway and any 404s are ignored because toy.
* It only loads components as it hits them in the HTML. Preloading some would be more performant.
* Bundler (like webpack) isn't needed, but we then have to deal with the `import` statements somehow. I'm using SystemJS for now.
* The controller in the js file is the default export. You don't even need to name the class, just write `export default class {` and implement.
* Said default exported class is called the controller.
* HTML template uses single braces to delimit substitutions. The possible substitutions are restricted to the controller's own properties. So, `{propname}` or `{methodcall(arg,arg)}` only. 
* You can put content between the opening and closing tags, to be inserted where `{innerHTML}` appears in the enclosing component's template.
* Event handler code is always in the controller, and the name is restricted to beginning with the event's name.  So `onClick`, `onClickEdit`, `onClickOpen` are all valid names for an onClick handler.
* Event handlers are wired to events merely by listing the method name: `<button onClickEdit />`.  It's more succint than `<button onClick={onClickEdit} />` which doesn't add anything other than escaping a resonable naming convention.  Note that event handler methods, as attributes, aren't surrounded by curly braces like other substitutions.
* Form field validation methods must begin with `must`, accept the value as the first argument and the form as the second argument, and return either a boolean or a Promise<boolean>. 
* Validation methods are placed on an element without decoration: `<input type=text mustBeVegetable />`.  Their attribute will be removed on render, but replaced if that validation method fails.  Also will appear attributes `needsWork` or `approval` on the same element.
* The `must` functions do not need to be put directly on the `input` element.  When placed on a non-input element like `div` it will find the input element within the element its placed on. This is assumed to be the common case, being placed on an element that wraps both input and styled error message so they can both use pure CSS to hide/show help text.  All validation attributes will appear on the wrapper element, not the contained input element. 

## ToDo 

* Failed validations appear in a controller property called `errors`.  It's falsy if no errors.
* If a `must` function is placed on an element with multiple input elements within it, the values of all of them are placed into an (object? array?) and passed to the function.
* `must` functions can be placed on the `<form>` element.  Cross-field validations can obviously go here, but they could also go on the dependent field as well.  `must` functions need not be pure functions.
* Anything that accepts a `must` function can accept attributes `validateOnBlur` or `validateOnChange` which determines how often the validation functions are called to update `errors`. This can be set in uif's global config and then overridden on a case-by-case basis.
* (When is mapping done?  I.e. changing string to Date, for instance.  Before `must` functions are ran. `mapX` functions perhaps? `parseX` and `stringifyX` for both directions? `inX` and `outX` even though which is which? `toX` and `fromX` then, like `toDate` and `fromDate`?) 
* If statements aren't done like any of the major frameworks.  It's a component, `<if>`, which easily accepts CSS transitions.  Unlike Angular & Vue it won't get lost among other attributes, and unlike React it won't much interfere with pure HTML/CSS staff on the project.  The `<if>` component itself always appears in the DOM even when false. Only its contents disappear.  
*  `<foreach varname={aggregateProp} indexvarname='index'>` creates temporary controller properties `varname` and `indexvarname` during its render.  Notice `index` is just a string literal. If `aggregateProp` holds an array, a `for..of` is performed.  If `aggregateProp` is an object, `for..in` is performed, returning `aggregateProp[indexvarname]` (`indexvarname` holds the property name instead of a number).  If `aggregateProp` is a number, a `for(let i = 0; i < aggregateProp; i++)` is performed.
* `<doWhile varname={condition}>` is also available.

## Try it out

After git cloning and `npm install`, just `npm run compile` and either `npm run https` (Chrome) or `npm run http` (Firefox).  Bring up the F12 console in the browser to look around. 
