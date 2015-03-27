'use strict';

var mdeps = require('module-deps'),
  path = require('path'),
  PassThrough = require('stream').PassThrough,
  parse = require('./streams/parse'),
  inferName = require('./streams/infer_name'),
  inferMembership = require('./streams/infer_membership');

// Skip external modules. Based on http://git.io/pzPO.
var externalModuleRegexp = process.platform === 'win32' ?
  /^(\.|\w:)/ :
  /^[\/.]/;

/**
 * Generate JavaScript documentation as a list of parsed JSDoc
 * comments, given a root file as a path.
 *
 * @param {Array<String>|String} indexes files to process
 * @return {Object} stream of output
 */
module.exports = function (indexes) {
  var md = mdeps({
    filter: function (id) {
      return externalModuleRegexp.test(id);
    }
  });

  if (typeof indexes === 'string') {
    indexes = [indexes];
  }

  indexes.forEach(function (index) {
    md.write(path.resolve(index));
  });
  md.end();

  var end = new PassThrough({ objectMode: true });

  function deferErrors(stream) {
    return stream.on('error', function (a, b, c) {
      end.emit('error', a, b, c);
      end.emit('end');
    });
  }

  return md
    .pipe(deferErrors(parse()))
    .pipe(deferErrors(inferName()))
    .pipe(deferErrors(inferMembership()))
    .pipe(end);
};
