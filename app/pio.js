var fs = require('fs');
var which = require('which');
var exec  = require('child_process').exec;
var spawn  = require('child_process').spawn;
var promisify = require('./helpers').promisify;

require('fix-path')();

exports.isPIO = () => promisify(which)('platformio');

exports.list=name=>new Promise((done,fail)=>{
  var stdout=[];
  var cmd = exec('platformio device list --json-output');
  cmd.stdout.on('data', (data) => {
    stdout.push(data)
//    console.log('data',data.toString());
  });
  cmd.stderr.on('data', (data) => {
    console.error('error',data.toString());
  });
  cmd.on('close', (code) => {
    code?fail(code):done(JSON.parse(stdout.join()));
  });
})
var tty2html = require('tty2html');

var compile=(commands, res, cwd)=>{
  var env = Object.assign({}, process.env, { PLATFORMIO_FORCE_COLOR: true});
  var verbose=0;
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-control": "no-cache" });
  var cmd = spawn('platformio', commands, {env: env, cwd: cwd || process.cwd() });
  var mw=tty2html()
  mw.pipe(res);
  cmd.stdout.pipe(mw);
  cmd.stderr.pipe(mw);
  if(verbose){
    cmd.stdout.on('data', (data) => {
      console.log('data',data.toString());
    });
    cmd.stderr.on('data', (data) => {
      console.error('error',data.toString());
    });
  }
  cmd.on('error', (data) => {
    res.write('command error');
    console.error('cmd error',data);
  });
  cmd.on('close', (code) => {
    res.end()
  });
  return cmd;
}
exports.run=compile;
exports.main=()=>{
console.log(process.cwd());
  compile('platformio run').then(a=>console.log(a));
}
//platformio run -t upload --upload-port /dev/ttyS0