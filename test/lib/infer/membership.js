'use strict';

var test = require('tap').test,
  _ = require('lodash'),
  parse = require('../../../lib/parsers/javascript'),
  inferMembership = require('../../../lib/infer/membership')();

function toComment(fn, file) {
  return parse({
    file: file,
    source: fn instanceof Function ? '(' + fn.toString() + ')' : fn
  });
}

function evaluate(fn, file) {
  return toComment(fn, file).map(inferMembership);
}

function Foo() {}
function lend() {}

test('inferMembership - explicit', function (t) {
  t.deepEqual(_.pick(evaluate(function () {
    /**
     * Test
     * @memberof Bar
     * @static
     */
    Foo.bar = 0;
  })[0], ['memberof', 'scope']), {
    memberof: 'Bar',
    scope: 'static'
  }, 'explicit');

  t.deepEqual(_.pick(evaluate(function () {
    /** Test */
    Foo.bar = 0;
  })[0], ['memberof', 'scope']), {
    memberof: 'Foo',
    scope: 'static'
  }, 'implicit');

  t.deepEqual(_.pick(evaluate(function () {
    /** Test */
    Foo.prototype.bar = 0;
  })[0], ['memberof', 'scope']), {
    memberof: 'Foo',
    scope: 'instance'
  }, 'instance');

  t.deepEqual(_.pick(evaluate(function () {
    /** Test */
    Foo.bar.baz = 0;
  })[0], ['memberof', 'scope']), {
    memberof: 'Foo.bar',
    scope: 'static'
  }, 'compound');

  t.deepEqual(_.pick(evaluate(function () {
    /** Test */
    (0).baz = 0;
  })[0], ['memberof', 'scope']), { }, 'unknown');

  t.deepEqual(_.pick(evaluate(function () {
    Foo.bar = {
      /** Test */
      baz: 0
    };
  })[0], ['memberof', 'scope']), {
    memberof: 'Foo.bar',
    scope: 'static'
  }, 'static object assignment');

  t.deepEqual(_.pick(evaluate(function () {
    Foo.prototype = {
      /** Test */
      bar: 0
    };
  })[0], ['memberof', 'scope']), {
    memberof: 'Foo',
    scope: 'instance'
  }, 'instance object assignment');

  t.deepEqual(_.pick(evaluate(function () {
    Foo.prototype = {
      /**
       * Test
       */
      bar: function () {}
    };
  })[0], ['memberof', 'scope']), {
    memberof: 'Foo',
    scope: 'instance'
  }, 'instance object assignment, function');

  t.deepEqual(_.pick(evaluate(function () {
    var Foo = {
      /** Test */
      baz: 0
    };
    return Foo;
  })[0], ['memberof', 'scope']), {
    memberof: 'Foo',
    scope: 'static'
  }, 'variable object assignment');

  t.deepEqual(_.pick(evaluate(function () {
    var Foo = {
      /** Test */
      baz: function () {}
    };
    return Foo;
  })[0], ['memberof', 'scope']), {
    memberof: 'Foo',
    scope: 'static'
  }, 'variable object assignment, function');

  t.deepEqual(_.pick(evaluate(function () {
    /** Test */
    module.exports = function () {};
  })[0], ['memberof', 'scope']), {
    memberof: 'module',
    scope: 'static'
  }, 'simple');

  t.deepEqual(_.pick(evaluate(function () {
    lend(/** @lends Foo */{
      /** Test */
      bar: 0
    });
  })[1], ['memberof', 'scope']), {
    memberof: 'Foo',
    scope: 'static'
  }, 'lends, static');

  t.deepEqual(_.pick(evaluate(function () {
    lend(/** @lends Foo */{
      /** Test */
      bar: function () {}
    });
  })[1], ['memberof', 'scope']), {
    memberof: 'Foo',
    scope: 'static'
  }, 'inferMembership - lends, static, function');

  t.deepEqual(_.pick(evaluate(function () {
    lend(/** @lends Foo.prototype */{
      /** Test */
      bar: 0
    });
  })[1], ['memberof', 'scope']), {
    memberof: 'Foo',
    scope: 'instance'
  });

  t.deepEqual(_.pick(evaluate(function () {
    lend(/** @lends Foo.prototype */{
      /** Test */
      bar: function () {}
    });
  })[1], ['memberof', 'scope']), {
    memberof: 'Foo',
    scope: 'instance'
  }, 'inferMembership - lends, instance, function');

  t.deepEqual(_.pick(evaluate(function () {
    /** Foo */
    function Foo() {
      /** Test */
      function bar() {}
      return {
        bar: bar
      };
    }
  })[1], ['memberof', 'scope']), {
    memberof: 'Foo',
    scope: 'static'
  }, 'inferMembership - revealing, static, function');

  t.equal(evaluate(function () {
    lend(/** @lends Foo */{});
    /** Test */
  })[1].memberof, undefined, 'inferMembership - lends applies only to following object');

  t.equal(evaluate(function () {
    lend(/** @lends Foo */{});
  })[0], undefined, 'inferMembership - drops lends');

  t.end();
});

test('inferMembership - exports', function (t) {
  t.equal(evaluate(function () {
    /** @module mod */
    /** foo */
    exports.foo = 1;
  })[1].memberof, 'mod');

  t.equal(evaluate(function () {
    /** @module mod */
    /** foo */
    exports.foo = function () {};
  })[1].memberof, 'mod');

  t.equal(evaluate(function () {
    /** @module mod */
    /** bar */
    exports.foo.bar = 1;
  })[1].memberof, 'mod.foo');

  t.equal(evaluate(function () {
    /** @module mod */
    exports.foo = {
      /** bar */
      bar: 1
    };
  })[1].memberof, 'mod.foo');

  t.equal(evaluate(function () {
    /** @module mod */
    exports.foo = {
      /** bar */
      bar: function () {}
    };
  })[1].memberof, 'mod.foo');

  t.equal(evaluate(function () {
    /** @module mod */
    /** bar */
    exports.foo.prototype.bar = function () {};
  })[1].memberof, 'mod.foo');

  t.equal(evaluate(function () {
    /** @module mod */
    exports.foo.prototype = {
      /** bar */
      bar: function () {}
    };
  })[1].memberof, 'mod.foo');

  t.end();
});

test('inferMembership - module.exports', function (t) {
  t.equal(evaluate(function () {
    /** @module mod */
    /** foo */
    module.exports.foo = 1;
  })[1].memberof, 'mod');

  t.equal(evaluate(function () {
    /** @module mod */
    /** foo */
    module.exports.foo = function () {};
  })[1].memberof, 'mod');

  t.equal(evaluate(function () {
    /** @module mod */
    /** bar */
    module.exports.foo.bar = 1;
  })[1].memberof, 'mod.foo');

  t.equal(evaluate(function () {
    /** @module mod */
    module.exports.foo = {
      /** bar */
      bar: 1
    };
  })[1].memberof, 'mod.foo');

  t.equal(evaluate(function () {
    /** @module mod */
    module.exports.foo = {
      /** bar */
      bar: function () {}
    };
  })[1].memberof, 'mod.foo');

  t.equal(evaluate(function () {
    /** @module mod */
    /** bar */
    module.exports.prototype.bar = function () {};
  })[1].memberof, 'mod');

  t.equal(evaluate(function () {
    /** @module mod */
    module.exports.prototype = {
      /** bar */
      bar: function () {}
    };
  })[1].memberof, 'mod');

  t.equal(evaluate(function () {
    /**
     * @module mod
     * @name exports
     */
    module.exports = 1;
  })[0].memberof, undefined);

  t.equal(evaluate(function () {
    /**
     * @module mod
     * @name exports
     */
    module.exports = function () {};
  })[0].memberof, undefined);

  t.equal(evaluate(function () {
    /** @module mod */
    module.exports = {
      /** foo */
      foo: 1
    };
  })[1].memberof, 'mod');

  t.end();
});

test('inferMembership - not module exports', function (t) {
  var result = evaluate(function () {
    /**
     * @module mod
     */
    /** Test */
    global.module.exports.foo = 1;
  }, '/path/mod.js');

  t.equal(result.length, 2);
  t.notEqual(result[0].memberof, 'mod');
  t.end();
});

test('inferMembership - anonymous @module', function (t) {
  var result = evaluate(function () {
    /**
     * @module
     */
    /** Test */
    exports.foo = 1;
  }, '/path/mod.js');

  t.equal(result.length, 2);
  t.equal(result[1].memberof, 'mod');
  t.end();
});

test('inferMembership - no @module', function (t) {
  var result = evaluate(function () {
    /** Test */
    exports.foo = 1;
  }, '/path/mod.js');

  t.equal(result.length, 1);
  t.equal(result[0].memberof, 'mod');
  t.end();
});
