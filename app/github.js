var fs = require('fs');
var path = require('path');
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
//.then(a=>a.filter((i,ind)=>ind<2))
.then(a=>a.filter(i=>i.type=='file'))
.then(a=>a.map(i=>getFile(i.download_url,path.join(__dirname,'..','views','gcode',i.name))))
.then(aw=>Promise.all(aw))
.then(a=>(verbose&&console.log('loaded files:',a),a))

exports.getConfig=verbose=>
getGHList('https://api.github.com/repos/MarlinFirmware/MarlinDocumentation/contents/_configuration')
.then(a=>a.filter(i=>i.name=='configuration.md'))
.then(a=>a.filter(i=>i.type=='file'))
.then(a=>a.map(i=>getFile(i.download_url,path.join(__dirname,'..','views',i.name))))
.then(aw=>Promise.all(aw))
.then(a=>(verbose&&console.log('loaded files:',a),a))
