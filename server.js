var express = require('express');
var path= require('path');
var opn = require('opn');
var mctool = require('./mc-tool');
var app = express();
var git = require('simple-git')();
var port= 3000;

var gitRoot=()=>
new Promise((done,fail)=>git.revparse(['--show-toplevel'],(e,a)=>e?fail(e):done(a.replace(/\r|\n/,''))))
.then(root=>(console.log('[gitroot]',root),root))


var gitTag=()=>
new Promise((done,fail)=>git.describe(['--tags'],(e,a)=>e?fail(e):done(a.replace(/\r|\n/,''))))
.then(root=>(console.log('[tag]',root),root))

var showGit=(branch,file)=>
new Promise((done,fail)=>Promise.resolve(branch).then(b=>git.show([b+':'+file+'.h'],(e,a)=>e?fail(e):done(a))));


var gitroot=gitRoot();
//var gittag=gitTag();

app.use('/static', express.static(path.resolve(__dirname, 'static')));

app.get('/', function (req, res) {
  res.send('Hello World!');
});
app.get('/tags', function (req, res) {
  git.tags(['--sort=-creatordate'],function (err, data) { //,"--format='%(creatordate) %(refname)'"
    res.send(data);
  });
});
var get_cfg=()=>{//new Promise((res,fail)=>{
  var list=['Marlin/Configuration'].map(f=>{ //'Marlin/Configuration_adv',
    var base=Promise.all([gitroot,showGit('1.1.0',f)]);
    return base
    .then(a=>mctool.getJson(a[0],a[1])(path.join(a[0],f+'.h')))
//    .then(a=>res(a))
  });
  return Promise.all(list)
}
//application/json
app.get('/now/', function (req, res) {
  res.set('Content-Type', 'text/plain');
  get_cfg().then(a=>res.send(JSON.stringify(a,null,2)))
});
app.get('/json/', function (req, res) {
  res.set('Content-Type', 'application/json');
  get_cfg().then(a=>res.send(a))
});
function main(){
app.listen(port, function () {
  console.log('Example app listening on port 3000!');
});
opn('http://localhost:'+port+'/now');
}
module.exports.main=main;
require.main===module && main();
