"use strict"

const exec = require("child_process").exec;
const builder = require("electron-builder")
const Platform = builder.Platform
const path = require("path");

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
//if(0)
config.beforeBuild=(args)=>new Promise((done,fail)=>{
//  if (args.platform.nodeName=='darwin')//skip it
//    return done();
  var cmd = 'npm run install '
//    + ' --target_platform='+args.platform.nodeName+' --target_arch='+args.arch
//    + ' --runtime=electron --target='+electron_version
  console.log('beforeBuild:',cmd);
  var env = Object.assign({},process.env,{
    npm_config_platform: args.platform.nodeName,
    npm_config_arch: args.arch,
  })
//  console.log(env);
  exec(cmd,{
    env: env,
    cwd: path.join(__dirname,'node_modules','serialport'),
    stdio: 'inherit'
  },(err,stdout,stderr)=>err?fail(stderr):(console.log(stdout),done(stdout)))
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