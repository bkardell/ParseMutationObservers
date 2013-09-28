(function(o) {
  "use strict";
  var exports = o;
  var assert = function() {};
  var UNSET = {"unset": "UNSET"};
  var ThenableCoercions = new WeakMap();
  function NewlyCreatedPromiseObject() {
    var promise = Object.create(Promise.prototype);
    promise._isPromise = true;
    promise._following = UNSET;
    promise._value = UNSET;
    promise._reason = UNSET;
    promise._derived = [];
    return promise;
  }
  function IsPromise(x) {
    return IsObject(x) && x._isPromise;
  }
  function Resolve(p, x) {
    if (is_set(p._following) || is_set(p._value) || is_set(p._reason)) {
      return;
    }
    if (IsPromise(x)) {
      if (SameValue(p, x)) {
        var selfResolutionError = new TypeError("Tried to resolve a promise with itself!");
        SetReason(p, selfResolutionError);
      } else if (is_set(x._following)) {
        p._following = x._following;
        x._following._derived.push({
          derivedPromise: p,
          onFulfilled: undefined,
          onRejected: undefined
        });
      } else if (is_set(x._value)) {
        SetValue(p, x._value);
      } else if (is_set(x._reason)) {
        SetReason(p, x._reason);
      } else {
        p._following = x;
        x._derived.push({
          derivedPromise: p,
          onFulfilled: undefined,
          onRejected: undefined
        });
      }
    } else {
      SetValue(p, x);
    }
  }
  function Reject(p, r) {
    if (is_set(p._following) || is_set(p._value) || is_set(p._reason)) {
      return;
    }
    SetReason(p, r);
  }
  function Then(p, onFulfilled, onRejected) {
    if (is_set(p._following)) {
      return Then(p._following, onFulfilled, onRejected);
    } else {
      var q = NewlyCreatedPromiseObject();
      var derived = {
        derivedPromise: q,
        onFulfilled: onFulfilled,
        onRejected: onRejected
      };
      UpdateDerivedFromPromise(derived, p);
      return q;
    }
  }
  function PropagateToDerived(p) {
    assert((is_set(p._value) && !is_set(p._reason)) || (is_set(p._reason) && !is_set(p._value)));
    p._derived.forEach(function(derived) {
      UpdateDerived(derived, p);
    });
    p._derived = [];
  }
  function UpdateDerived(derived, originator) {
    assert((is_set(originator._value) && !is_set(originator._reason)) || (is_set(originator._reason) && !is_set(originator._value)));
    if (is_set(originator._value)) {
      if (IsObject(originator._value)) {
        QueueAMicrotask(function() {
          if (ThenableCoercions.has(originator._value)) {
            var coercedAlready = ThenableCoercions.get(originator._value);
            UpdateDerivedFromPromise(derived, coercedAlready);
          } else {
            var then = UNSET;
            try {
              then = originator._value.then;
            } catch (e) {
              UpdateDerivedFromReason(derived, e);
            }
            if (is_set(then)) {
              if (IsCallable(then)) {
                var coerced = CoerceThenable(originator._value, then);
                UpdateDerivedFromPromise(derived, coerced);
              } else {
                UpdateDerivedFromValue(derived, originator._value);
              }
            }
          }
        });
      } else {
        UpdateDerivedFromValue(derived, originator._value);
      }
    } else if (is_set(originator._reason)) {
      UpdateDerivedFromReason(derived, originator._reason);
    }
  }
  function UpdateDerivedFromValue(derived, value) {
    if (IsCallable(derived.onFulfilled)) {
      CallHandler(derived.derivedPromise, derived.onFulfilled, value);
    } else {
      SetValue(derived.derivedPromise, value);
    }
  }
  function UpdateDerivedFromReason(derived, reason) {
    if (IsCallable(derived.onRejected)) {
      CallHandler(derived.derivedPromise, derived.onRejected, reason);
    } else {
      SetReason(derived.derivedPromise, reason);
    }
  }
  function UpdateDerivedFromPromise(derived, promise) {
    if (is_set(promise._value) || is_set(promise._reason)) {
      UpdateDerived(derived, promise);
    } else {
      promise._derived.push(derived);
    }
  }
  function CoerceThenable(thenable, then) {
    var p = NewlyCreatedPromiseObject();
    var resolve = function(x) {
      Resolve(p, x);
    };
    var reject = function(r) {
      Reject(p, r);
    };
    try {
      then.call(thenable, resolve, reject);
    } catch (e) {
      Reject(p, e);
    }
    ThenableCoercions.set(thenable, p);
    return p;
  }
  function CallHandler(derivedPromise, handler, argument) {
    QueueAMicrotask(function() {
      var v = UNSET;
      try {
        v = handler(argument);
      } catch (e) {
        Reject(derivedPromise, e);
      }
      if (is_set(v)) {
        Resolve(derivedPromise, v);
      }
    });
  }
  function SetValue(p, value) {
    assert(!is_set(p._value) && !is_set(p._reason));
    p._value = value;
    p._following = UNSET;
    PropagateToDerived(p);
  }
  function SetReason(p, reason) {
    assert(!is_set(p._value) && !is_set(p._reason));
    p._reason = reason;
    p._following = UNSET;
    PropagateToDerived(p);
  }
  function ToPromise(x) {
    if (IsPromise(x)) {
      return x;
    } else {
      var p = NewlyCreatedPromiseObject();
      Resolve(p, x);
      return p;
    }
  }
  function IsObject(x) {
    return (typeof x === "object" && x !== null) || typeof x === "function";
  }
  function IsCallable(x) {
    return typeof x === "function";
  }
  function SameValue(x, y) {
    return Object.is(x, y);
  }
  function QueueAMicrotask(func) {
    process.nextTick(function() {
      func();
    });
  }
  function is_set(internalPropertyValue) {
    return internalPropertyValue !== UNSET;
  }
  function define_method(object, methodName, method) {
    Object.defineProperty(object, methodName, {
      value: method,
      configurable: true,
      writable: true
    });
  }
  function Promise(resolver) {
    if (!IsCallable(resolver)) {
      throw new TypeError("non-callable resolver function");
    }
    var promise = NewlyCreatedPromiseObject();
    var resolve = function(x) {
      Resolve(promise, x);
    };
    var reject = function(r) {
      Reject(promise, r);
    };
    try {
      resolver.call(undefined, resolve, reject);
    } catch (e) {
      Reject(promise, e);
    }
    return promise;
  }
  define_method(Promise, "resolve", function(x) {
    var p = NewlyCreatedPromiseObject();
    Resolve(p, x);
    return p;
  });
  define_method(Promise, "reject", function(r) {
    var p = NewlyCreatedPromiseObject();
    Reject(p, r);
    return p;
  });
  define_method(Promise, "cast", function(x) {
    return ToPromise(x);
  });
  define_method(Promise, "race", function(iterable) {
    var returnedPromise = NewlyCreatedPromiseObject();
    var resolve = function(x) {
      Resolve(returnedPromise, x);
    };
    var reject = function(r) {
      Reject(returnedPromise, r);
    };
    {
      var $__0 = traceur.runtime.getIterator(iterable);
      try {
        while ($__0.moveNext()) {
          var nextValue = $__0.current;
          {
            var nextPromise = ToPromise(nextValue);
            Then(nextPromise, resolve, reject);
          }
        }
      } finally {
        if ($__0.close) $__0.close();
      }
    }
    return returnedPromise;
  });
  define_method(Promise, "all", function(iterable) {
    var valuesPromise = NewlyCreatedPromiseObject();
    var rejectValuesPromise = function(r) {
      Reject(valuesPromise, r);
    };
    var values = [];
    var countdown = 0;
    var index = 0;
    {
      var $__0 = traceur.runtime.getIterator(iterable);
      try {
        while ($__0.moveNext()) {
          var nextValue = $__0.current;
          {
            var currentIndex = index;
            var nextPromise = ToPromise(nextValue);
            var onFulfilled = function(v) {
              Object.defineProperty(values, currentIndex, {
                value: v,
                writable: true,
                enumerable: true,
                configurable: true
              });
              countdown = countdown - 1;
              if (countdown === 0) {
                Resolve(valuesPromise, values);
              }
            };
            Then(nextPromise, onFulfilled, rejectValuesPromise);
            index = index + 1;
            countdown = countdown + 1;
          }
        }
      } finally {
        if ($__0.close) $__0.close();
      }
    }
    if (index === 0) {
      Resolve(valuesPromise, values);
    }
    return valuesPromise;
  });
  define_method(Promise.prototype, "then", function(onFulfilled, onRejected) {
    return Then(this, onFulfilled, onRejected);
  });
  define_method(Promise.prototype, "catch", function(onRejected) {
    return Then(this, undefined, onRejected);
  });
  exports.Promise = Promise;
  return exports;
}(this.exports || this.ProllyfillRoot || this));
