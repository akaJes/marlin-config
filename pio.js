var fs = require('fs');
var which = require('which');
var exec  = require('child_process').exec;

exports.isPIO=()=>new Promise((done,fail)=>which('platformio',(err, resolvedPath)=>err?fail(err):done(resolvedPath)));
//exports.isPIO().then(a=>console.log(a));
//


exports.list=name=>new Promise((done,fail)=>{
  var stdout=[];
  var cmd = exec('platformio device list --json-output');// 
//  var timer = setInterval(a=>process.stdout.write("."), 500)
  cmd.stdout.on('data', (data) => {
    stdout.push(data)
//    console.log('data',data.toString());
  });
  cmd.stderr.on('data', (data) => {
    console.error('error',data.toString());
  });
  cmd.on('close', (code) => {
//    clearInterval(timer);
//    console.log();
    code?fail(code):done(JSON.parse(stdout.join()));
  });
})
//exports.list().then(a=>console.log(a));

var compile=command=>new Promise((done,fail)=>{
  var stdout=[];
  var cmd = exec(command);// 
//  var timer = setInterval(a=>process.stdout.write("."), 500)
  cmd.stdout.on('data', (data) => {
    stdout.push(data)
    console.log('data',data.toString());
  });
  cmd.stderr.on('data', (data) => {
    console.error('error',data.toString());
  });
  cmd.on('close', (code) => {
//    clearInterval(timer);
//    console.log();
//    code?fail(code):done(JSON.parse(stdout.join()));
    code?fail(code):done(stdout);
  });
})

exports.main=()=>{
console.log(process.cwd());
  compile('platformio run').then(a=>console.log(a));
}
//platformio run -t upload --upload-port /dev/ttyS0