ParseMutationObservers
======================

A fast/efficient mechanism for watching DOM parse.

In the course of [extending the web forward](http://extensiblewebmanifesto.org), we are encountering situations in which we are filling functionality which will ultimately be handled during the native parse.   Some examples:

* HTML Imports use `<link>` tags to signal things that need to be downloaded and imported
* Recently there has been discussion about how you might add preloading, promises, dependency attributes to `<script>` elements (see WHATWG archives) - RequireJS has “data-main” as another example.
* Anything that prollyfills CSS examines `<link>` or `<style>` tags, like [http://hitchjs.com](Hitch).
* Anything that uses string based templates by way of `<link>` or `<script>` tags that need to be downloaded or compiled, like Handlebars does.

Currently, most of these use the `DOMContentLoaded` event or careful positioning of the initiating script to signal initiation.  Since many of these require initiating http GETs, parsing the received source and coordination of these "compiled" resources, it means upfront latency and unfortunately exaggerated delays.  On mobile devices or situations where bandwidth is limited, `DOMContentLoaded` can take several seconds to trigger and when it finally does it generally means that CSS and the HTML parse itself have often populated the request queue with asset requests (images, videos, stylesheets, etc).  The net result is that things are dramatically slower than they would be if they we handled in the proper order by the parse and any [http://prollyfill.org](prollyfill) developed in this fashion is decidely low fidelity in this regard.  In many cases, this is a decidedly bad thing as switching these timing variables can yield dramatically differrent user experience.


Manging this more accurately *is* possible but getting a pattern right is cumbersome and full of boilerplate.  `ParseMutationObserver`s make this easy.

#### Basic Usage
Include this in the `<head>` of your document...
```
<script src="/path/to/parse-mutation-observer.js"></script>
```

The basic signature looks like this:
```javascript
new ParseMutationObserver(selectorQuery);
```

You can attach a listener to be notified of (an array of buffered elements) discovered during parse by registering for `notify` events via the `on` method:
```javascript
var cssLinksObserver = new ParseMutationObserver('link[type="text/css"]');

cssLinksObserver.on('notify', function (elements) {
	// do some work with those elements... This can also return a promise read below... 
});
```

`ParseMutationObserver`s also expose a method that can let you know when the initial parse is complete (`DOMContentLoaded`) and, if the notify function returned any `promises`, that those have been fulfilled or rejected as well. 

```javascript
var cssLinksObserver = new ParseMutationObserver('link[type="text/css"]');

cssLinksObserver.on('notify', function (elements) {
	// do some work with those elements... 
});

cssLinksObserver.on('done', function () {
	// the work of initial parse is complete.
});
```

Since most times the pattern involves fetching sources and/or compiling, `ParseMutationObserver` ships with some helper methods to expose the stuff necessary 
to do this work.  Namely:

* `ParseMutationObserver.Promise` (common promises design with all the normal stuff) 
* `ParseMutationObserver.promiseUrl(url)` simple `XMLHttpRequest` GET with `Promise` return;

## Stringing it all together...
This means that you can very easily accomplish a lot, efficiently.  Considering a hyptothetical example called `example` which 
defines a new `<link>` type, async fetches the url based on `href` as soon as possible, calls a `precompile(source)` with the 
returned result, and when all of those things have completed calls a `compile()` and `init()` to perform related DOM work..
You could accomplish as:

```javascript
var exampleLinksObserver = new ParseMutationObserver('link[type="text/example"]');
var promiseAndPrecompile = function (url) {
	return ParseMutationObserver.urlPromise(url).then(function(text) {
		example.precompile(text);
	});
};
exampleLinksObserver.on('notify', function (elements) {
	var promises = [];
	elements.forEach(function (el) {
		promises.push(promiseAndPrecompile(el.getAttribute("href")));
	});
	return new ParseMutationObserver.Promise.all(promises);
});

exampleLinksObserver.on('done', function () {
	// the work of initial parse is complete, all of that precompiling stuff is done - go!
	example.compile();
	example.init();
});
```
