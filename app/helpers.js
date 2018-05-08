'use strict';
var fs = require('fs');
var path = require('path');

Object.prototype.filter = function( predicate, obj ) {
    var result = { };
    obj = obj || this
    for (var key in obj) {
        if( obj.hasOwnProperty(key) && predicate( obj[key], key, obj ) ) {
            result[key] = obj[key];
        }
    }
    return result;
};

function atob(b64) {
  return process.version < "v6.0.0" ? Buffer.from(b64, 'base64') : new Buffer(b64, 'base64');
}

function promisify(func,that) {
  return function() {
    return new Promise((resolve, reject) => {
      const args = Array.prototype.slice.apply(arguments);
      args.push((err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data);
      });
      (that&&that[func]||func).apply(that||null, args);
    });
  };
}
var walk = function(dir){
  return new Promise(function(done,fail) {
    var results = [];
    fs.readdir(dir, function(err, list) {
      if (err) return fail(err);
      var pending = list.length;
      if (!pending) return done(results);
      list.forEach(function(file) {
        file = path.resolve(dir, file);
        fs.stat(file, function(err, stat) {
          if (stat && stat.isDirectory()) {
            walk(file).then(function(res) {
              results = results.concat(res);
              if (!--pending) done(results);
            });
          } else {
            results.push(file);
            if (!--pending) done(results);
          }
        });
      });
    });
  })
};

function getFirstFile(paths) {
  if (!paths || paths.length == 0)
    return Promise.reject();
  var filePath = paths.shift();
  return promisify(fs.access)(filePath, fs.constants.R_OK)
    .then(a => filePath)
    .catch(e => getFirstFile(paths) );
}

const unique = a => a.filter((elem, index, self) => index == self.indexOf(elem))

module.exports = {
  promisify,
  walk,
  atob,
  getFirstFile,
  unique,
};