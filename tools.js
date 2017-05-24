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
yaml = require('js-yaml');
fs   = require('fs');

// Get document, or throw exception on error
if(0)
try {
  yaml.safeLoadAll(fs.readFileSync('views/gcode/G000-G001.md', 'utf8'), function (doc) {
    console.log(doc);
  });
} catch (e) {
  console.log(e);
}
var promisify = require('./app/helpers').promisify;

var http = require('https');
var url = require('url');

var getGHList=(uri)=>new Promise((done,fail)=>{
  var options=url.parse(uri);
  options.headers={
    Accept: 'application/json',
    "User-Agent":"Mozilla/5.0",
  };
  http.get(options,res=>{
    res.setEncoding('utf8');
    var text='';
    res.on('data', function (chunk) {
      text+=chunk;
    })
    res.on('end', function () {
      done(JSON.parse(text));
    });
  })
})

var getFile=(url,name)=>new Promise((done,fail)=>{
  var file = fs.createWriteStream(name);
  var request = http.get(url, function(response) {
      response.pipe(file);
      response.on('end',()=>done(name));
  });
})

exports.getGCodes=verbose=>
getGHList('https://api.github.com/repos/MarlinFirmware/MarlinDocumentation/contents/_gcode')
.then(a=>a.filter((i,ind)=>ind<2))
.then(a=>a.filter(i=>i.type=='file'))
.then(a=>a.map(i=>getFile(i.download_url,path.join(__dirname,'views','gcode',i.name))))
.then(aw=>Promise.all(aw))
.then(a=>(verbose&&console.log('loaded files:',a),a))

exports.getConfig=verbose=>
getGHList('https://api.github.com/repos/MarlinFirmware/MarlinDocumentation/contents/_configuration')
.then(a=>a.filter(i=>i.name=='configuration.md'))
.then(a=>a.filter(i=>i.type=='file'))
.then(a=>a.map(i=>getFile(i.download_url,path.join(__dirname,'views',i.name))))
.then(aw=>Promise.all(aw))
.then(a=>(verbose&&console.log('loaded files:',a),a))

exports.getConfig(1)