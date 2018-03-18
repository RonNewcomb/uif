# uif
a toy UI framework

I have sort of a love/hate relationship with Angular, because it requires a lot of boilerplate.  But I like React even less, because it does the old AngularJS practice of every model used in a template must be prefaced with an object. (The name of the controller in AngularJS's case, "prop" or "state" in React's case.)  Most other frameworks I've seen, like Vue and Svelte, have the same issues.  

And don't get me started on the 'flux' approach that Redux uses; there's only 2½ languages that support function-invocation-is-a-hook-for-triggers, and that's Smalltalk, Objective-C, and AspectJ. And no-one likes Objective-C. My employer used this in an Actionscript3 (Flash) project.  Decoupling effects from events so that handlers don't need to know about each other sounds nice, but in practice they created race conditions affected by merely renaming a source file: the compiler hit it in a different order, so the handlers ended up in a differnt order, and nothing is truly decoupled while it exists in the same app. Plus the IDE tooling couldn't follow the chain with "find all references" or similar. You had to do it manually everytime. The fact that Actionscript3 lacks generics means you'd also forget what type the payload is, since you couldn't do `Event<T>`.

This UI-f chooses a convention-over-configuration approach with components / custom tags:
* The HTML tag name is also the filename of the js, css, and html which implement it. All frameworks allow this through configuration, but here it's required.
* All 3 files are optional. They're requested anyway and any 404s are ignored because this toy doesn't operate with a manifest.
* You can put content between the opening and closing tags, to be inserted where `<innerHTML/>` appears in the enclosing component's template.
* `<if>` and `<each>` (also called `for`) are their own elements instead of attribute-components. I find this cleaner and easier to learn, if a bit inconvenient at times. 
* The toy operates naïvely: instead of loading the app, it only loads components as it hits them in the HTML. Preloading [at least some of] them via a manifest listing the files would be more performant.
