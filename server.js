var express = require('express');
var path= require('path');
var opn = require('opn');
var mctool = require('./mc-tool');
var app = express();
var git = require('./git-tool');
var getPort = require('get-port');
var hints = require('./hints');
var fs = require('fs');

var port= 3000;

app.use('/static', express.static(path.resolve(__dirname, 'static')));
app.use('/static/libs', express.static(path.resolve(__dirname, 'node_modules')));

app.get('/', function (req, res) {
  res.send('Hello World!');
});
app.get('/tags', function (req, res) {
  git.git.tags(['--sort=-creatordate'],function (err, data) { //,"--format='%(creatordate) %(refname)'"
    res.send(data);
  });
});
//var tag=git.Tag();
//console.log(tag);
var get_cfg=()=>{//new Promise((res,fail)=>{
  var base=Promise.all([git.root(),git.Tag()]);
  var list=['Marlin/Configuration.h','Marlin/Configuration_adv.h'].map(f=>{
    return base
      .then(p=>git.Show(p[1],f).then(file=>mctool.getJson(p[0],file,p[1])(path.join(p[0],f))))
      .then(o=>(o.names.filter(n=>hints.d2i[n.name],1).map(n=>o.defs[n.name].hint=!0),o))
//      .then(o=>(o.names.map(n=>o.defs[n]&&(o.defs[n].hint=1)),o))
      .then(a=>(a.names=undefined,a))
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
app.get('/hint/:name', function (req, res) {
//  res.send('<a href='+hints.url+'>Documentation</a>');
  res.send(hints.hint(req.params.name));
  //res.send(req.params)
})
app.post('/set/:file/:name/:prop/:value', function (req, res) {
  git.root()
  .then(root=>{
    var ob=[{ name:req.params.name}]
    if (req.params.prop=='disabled')
      ob[0].disabled=req.params.value=='true';
    else
      ob[0][req.params.prop]=req.params.value;
    return mctool.updateH(root,path.join(root,'Marlin',req.params.file+'.h'),ob);
  })
  .then(a=>res.send(req.params))
  .catch(a=>res.status(403).send(a))
})
function main(){
  git.root()
  .then(root=>{
    fs.stat(path.join(root,'Marlin'),(e,a)=>{
    if(!a)
      console.log('this git not look like Marlin repository');
    else
      getPort(3000).then(port => {
        app.listen(port, function () {
          console.log('Marlin config tooll started on port http://localhost:'+port);
        });
        opn('http://localhost:'+port+'/static');
      });
    })
  })
}
module.exports.main=main;
require.main===module && main();
