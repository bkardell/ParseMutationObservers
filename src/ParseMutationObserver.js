/* globals RSVP */
(function (attachTo) {
    "use strict";
    var fetchTextAndPromise = function(url) {
        var promise = new attachTo.Promise(function(resolve, reject){
        var client = new XMLHttpRequest();
        var handler = function handler() {
        if (this.readyState === this.DONE) {
            if (this.status === 200) { resolve(this.response); }
            else { reject(this); }
            }
        };
        client.open("GET", url);
        client.onreadystatechange = handler;
        client.responseType = "text";
        client.setRequestHeader("Accept", "text");
        client.send();
        });
        return promise;
    };
    attachTo.Promise = RSVP.Promise;
    attachTo.Promise.all = RSVP.all;
    attachTo.ParseMutationObserver = function (filterQuery) {
        var connected,
            eventCallbacks = {},
            self = this,
            promises = [],
            docEl = document.documentElement,
            matches = docEl.matches || docEl.webkitMatchesSelector || docEl.mozMatchesSelector || docEl.msMatchesSelector || docEl.oMatchesSelector,
            test = function(element) {
                return element.nodeType === 1 && matches.call(element, filterQuery);
            },
            MutationObserver = document.MutationObserver || document.WebKitMutationObserver,
            observer = new MutationObserver(function(mutations) {
                var mutation, buff = [];
                for (var x = 0;x<mutations.length;x++) {
                    mutation = mutations[x];
                    for (var i=0;i<mutation.addedNodes.length;i++) {
                        if (test(mutation.addedNodes[i])) {
                            buff.push(mutation.addedNodes[i]);
                        }
                    }
                }
                if (buff.length > 0 ) {
                    notify("notify", buff);
                }
            }),
            getLazyCall = function(cb, arr) {
                return function () {
                    var promise = cb.call(self,arr);
                    if (promise) {
                        promises.push(promise);
                    }
                };
            },
            notify = function (eventName, arr) {
                var cbs = eventCallbacks[eventName];
                var max = (cbs||[]).length;
                for (var i=0;i<max;i++) {
                    getLazyCall(cbs[i], arr)();
                }
            };

        // find elements already in the doc
        var alreadyParsed = docEl.querySelectorAll(filterQuery);
        var alreadyParsedBuff = [];
        for (var i=0;i<alreadyParsed.length;i++) {
          if (test(alreadyParsed[i])) {
            alreadyParsedBuff.push(alreadyParsed[i]);
          }
        }

        // Wire it up please...
        observer.observe(docEl,
            { attributes: false, subtree: true, childList: true }
        );

        this.on = function (n, cb) {
            eventCallbacks[n] = eventCallbacks[n] || [];
            eventCallbacks[n].push(cb);
            if (!connected) {
                connected = true;
                //check();
            }
            notify("notify", alreadyParsedBuff);
        };
        this.disconnect = function () {
            observer.disconnect();
        };
        document.addEventListener("DOMContentLoaded", function () {
            window.__domContentLoadedTime = Date.now();
            if (connected) {
               self.disconnect(true);
            }
            attachTo.Promise.all(promises).then(function(){
                var cbs = eventCallbacks.done;
                var max = (cbs||[]).length;
                for (var i=0;i<max;i++) {
                    eventCallbacks.done[i]();
                }
            });
        });
    };
    attachTo.ParseMutationObserver.fetchPromise = fetchTextAndPromise;
}(window.ProllyfillRoot || window));