# uif
a toy UI framework

* The HTML tag name is also the filename of the js, css, and html which implement it. All frameworks allow this through configuration, but here it's required.
* All 3 files are optional. They're requested anyway and any 404s are ignored because this toy doesn't operate with a manifest.
* The controller in the js file is the default export. You don't even need to name the class, just write `export default class {` and implement.
* (If you dislike default exports, then class name must match the tag name. Any hyphens or periods in the tagname are simply removed. I could add additional code to translate hyphenated tag names to TitleCase like Typescript prefers class names, but I've had bad experiences with AngularJS and its kebab-case vs camelCase distinctions. Hyphens aren't valid javascript identifiers so trying to name a class will stop the coder, though it may not be obvious that he merely needs to remove them. Hence, use default export.)
* You can put content between the opening and closing tags, to be inserted where `<innerHTML/>` appears in the enclosing component's template. TODO: that would probably make more sense as a controller property, like `{{innerHTML}}` or somesuch, rather than the special tag method that Angular uses.
* `<if>` and `<each>` (also called `for`) are their own elements instead of attribute-components. I find this cleaner and easier to learn, if a bit inconvenient at times. 
* The toy operates naïvely: instead of loading the app, it only loads components as it hits them in the HTML. Preloading [at least some of] them via a manifest listing the files would be more performant.


After git cloning and `npm install`, just `npm run compile` and `npm run serve`.  Bring up the F12 console in the browser to look around. 
