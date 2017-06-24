"use strict"

const exec = require("child_process").exec;
const builder = require("electron-builder")
const Platform = builder.Platform

var electron_version="1.6.11";
var archs="all";//"ia32","x64","all"
var platforms=[
  Platform.WINDOWS,
  Platform.LINUX,
  Platform.MAC,
];

const pjson = require('./package.json');
var config=Object.assign({},pjson.build);
//config.asar=false;

//prebuild serialport
config.beforeBuild=(args)=>new Promise((done,fail)=>{
  if (args.platform.nodeName=='darwin')//skip it
    return done();
  var cmd = 'npm rebuild serialport-v4 --update-binary'
    + ' --target_platform='+args.platform.nodeName+' --target_arch='+args.arch
    + ' --runtime=electron --target='+electron_version
  console.log('beforeBuild:',cmd);
  exec(cmd,(err,stdout,stderr)=>err?fail(stderr):(console.log(stdout),done(stdout)))
});
//console.log(builder.createTargets(platforms,null,archs))
//if(0)
builder.build({
  targets: builder.createTargets(platforms,null,archs),
  config: config,
})
.then(() => {
  // handle result
  console.log('done')
})
.catch((error) => {
  // handle error
  console.error(error)
})