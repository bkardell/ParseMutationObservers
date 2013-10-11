/* globals RSVP */
(function (attachTo) {
    "use strict";
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
            lastIndex = 0,
            filterAndNotify = function (list) {
                var buff = [];
                var i = (!MutationObserver) ? lastIndex : 0;
                for (;i<list.length;i++) {
                    lastIndex++;
                    if (test(list[i])) {
                        buff.push(list[i]);
                    }
                }
                if (buff.length > 0 ) {
                    notify("notify", buff);
                }
            },
            observer = (function () {
              var re = /link|script|style|head|body/g, tagName, liveList, connected = true, once = false;
              if (!MutationObserver && re.test(filterQuery)) {
                  // really imperfect but it just needs to be close enough for jazz for known use cases in IE.old
                return {
                  observe: function () {
                    var watchAndNotify = function (){
                      // crap, need to track last index as from bufferedparseobserver...
                      setTimeout(function () {
                          filterAndNotify(liveList);
                          if (connected || !once) {
                              once = true;
                              watchAndNotify();
                          }
                      });
                    };
                    tagName = filterQuery.match(/link|script|style|head|body/)[0].replace(/^\s+|\s+$/g, '');
                    liveList = document.getElementsByTagName(tagName);
                    watchAndNotify();
                  },
                  disconnect: function () { connected = false; },
                  _emulated: true
                };
              }
              return new MutationObserver(function(mutations) {
                var mutation;
                for (var x = 0;x<mutations.length;x++) {
                    mutation = mutations[x];
                    filterAndNotify(mutation.addedNodes);
                }
              });
            }()),
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
        var alreadyParsed = (observer._emulated) ? [] : docEl.querySelectorAll(filterQuery);
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
            if (alreadyParsedBuff.length > 0) {
              notify("notify", alreadyParsedBuff);
            }
        };
        this.disconnect = function () {
            observer.disconnect();
        };
        document.addEventListener("DOMContentLoaded", function () {
            window.__domContentLoadedTime = Date.now();
            if (connected) {
               self.disconnect(true);
            }
            attachTo.ParseMutationObserver.Promise.all(promises).then(function(){
                var cbs = eventCallbacks.done;
                var max = (cbs||[]).length;
                for (var i=0;i<max;i++) {
                    eventCallbacks.done[i]();
                }
            });
        });
    };
    attachTo.ParseMutationObserver.version = "0.1.0";
    attachTo.ParseMutationObserver.Promise = RSVP.Promise;
    attachTo.ParseMutationObserver.Promise.all = RSVP.all;
    attachTo.ParseMutationObserver.promiseUrl = function(url) {
        var promise = new attachTo.ParseMutationObserver.Promise(function(resolve, reject){
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
}(window.ProllyfillRoot || window));