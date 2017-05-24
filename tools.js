#! /usr/bin/env node
var SerialPort = require('serialport');
var fs = require('fs')
var path = require('path')

SerialPort.list(function (err, ports) {
  ports.forEach(function(port) {
    if (!port.manufacturer) return;
    console.log(port.comName);
    console.log(port.pnpId);
    console.log(port.manufacturer);
  });
});
var root='/dev'
if(0)
fs.watch(root, {encoding0: 'buffer'}, (eventType, filename) => {
//  myEmitter = new MyEmitter();
  if (eventType=='rename')
    fs.stat(path.join(root,filename),function(err,stats){
      if(err) console.log(err);
      else
        console.log(stats)
    })
  //if (filename)
  //  console.log(filename,eventType);
    // Prints: <Buffer ...>
});
var yaml = require('js-yaml');
var fs   = require('fs');
var swig  = require('swig-templates');
var hints  = require('./app/hints');
var hljs=require('highlight.js');

//    return hljs.highlightAuto(code).value;

//http://marlinfw.org/docs/gcode/G000-G001.html

swig.setTag('alert',function(){ return true;},function(){ return '';},true);
swig.setTag('highlight',function(str, line, parser) {
return true;
},function(compiler, args, content, parents, options, blockName){
//console.log(content);
//var txt= hljs.highlightAuto(content).value;
return compiler(content, parents, options, blockName);
},true);
swig.setTag('avatar',function(){ return true;},function(){ return '';});

swig.setFilter('append', function (input,val) { return input+val; })
swig.setFilter('split', function (input,val) { return input.split(val); })
swig.setFilter('push', function (input,val) { input.push(val); return input; })
swig.setFilter('array', function (input) { return Array.isArray(input)&&input||[input]; })

swig.setFilter('markdownify', function (input) {
var tokens = hints.marked.lexer(input);
//console.log( hints.marked.parser(tokens))
return ( hints.marked.parser(tokens) );
})

var template = swig.compileFile(path.join(__dirname,'views','gcode-info.html'));

// Get document, or throw exception on error
try {
  yaml.safeLoadAll(fs.readFileSync('views/gcode/G000-G001.md', 'utf8'), function (doc) {
if (!doc)return
var output = template({
    page: {category:[]},
    gcode:doc,
});
console.log('<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.7/css/bootstrap-theme.css" />')
console.log('<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.7/css/bootstrap.css" />');
console.log('<script src="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.7/js/bootstrap.js"></script>');
//    console.log(doc);
    console.log(output);
  });
} catch (e) {
  console.log(e);
}
