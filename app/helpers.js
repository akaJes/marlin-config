'use strict';
var fs = require('fs');
var path = require('path');

function promisify(func) {
  return function() {
    return new Promise((resolve, reject) => {
      const args = Array.prototype.slice.apply(arguments);
      args.push((err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data);
      });
      func.apply(null, args);
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

module.exports = {
  promisify,
  walk,
};