var express = require('express');
var path = require('path');
var opn = require('opn');
var mctool = require('./mc-tool');
var app = express();
var git = require('./git-tool');
var getPort = require('get-port');
var hints = require('./hints');
var fs = require('fs');
var formidable = require('formidable');
var pjson = require('../package.json');
var pio = require('./pio');
var http = require('http');
var ua = require('universal-analytics');
var promisify = require('./helpers').promisify;

var port = 3000;
var server = http.Server(app);
var visitor = ua('UA-99239389-1');
var isElectron=module.parent&&module.parent.filename.indexOf('index.js')>=0;

var serial;
var serial_enabled = !(isElectron&&process.platform=='darwin');
if (serial_enabled)
  serial = require('./console');

app.use('/', express.static(path.join(__dirname,'..', 'static')));
app.use('/libs', express.static(path.join(__dirname,'..', 'node_modules')));

app.get('/tags', function (req, res) {
  git.Tags().then(data=>{
    res.send(data);
  });
});
var SSEports=[];
function SSEsend(event,data){
  SSEports.forEach(function(res){
    res.write("event: " + event + "\n");
    res.write("data: " + JSON.stringify(data) + "\n\n");
  });
}
function serial_init(){
  return serial.changes().then(monitor=>{
    monitor.on("created", function (f, stat) {
      SSEsend('created',f)
//      serial.list().then(a=>SSEsend('list',a));
    })
    monitor.on("deleted", function (f, stat) {
      SSEsend('deleted',f)
//      serial.list().then(a=>SSEsend('list',a));
    })
    monitor.on("opened", function (f, stat) {
      SSEsend('opened',f)
    })
    monitor.on("closed", function (f, stat) {
      SSEsend('closed',f)
    })
  }).catch(a=>console.error(a));
}
app.get('/ports', function (req, res) {
  if(!serial_enabled)
    return res.status(403).end()
  req.socket.setTimeout(Number.MAX_SAFE_INTEGER);
  console.log('SSE conected');
  res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
  });
  SSEports.push(res);
  serial.list().then(a=>SSEsend('list',a));
  console.log('list sent');
  req.on('close',function(){
    var i=SSEports.indexOf(res);
    if (i>=0)
      SSEports.splice(i,1);
    console.log('SSE removed');
  })
});

app.get('/port/:port/:speed', function (req, res) {
  if(!serial_enabled)
    return res.status(404)
  serial.init(server,req.params.port,req.params.speed)
  .then(data=>{
    res.send(data);
  })
  .catch(a=>res.status(403).send(a))
});
app.get('/port-close/:port', function (req, res) {
  if(!serial_enabled)
    return res.status(404)
  serial.close(req.params.port)
  .then(data=>{
    res.send(data);
  })
  .catch(a=>res.status(403).send(a))
});
app.get('/checkout/:branch', function (req, res) {
  git.Checkout(req.params.branch)
  .then(data=>{
    res.send(data);
  })
  .catch(a=>res.status(403).send(a))
});
var get_cfg=()=>{
  var base=Promise.all([git.root(),git.Tag()]);
  var list=['Marlin/Configuration.h','Marlin/Configuration_adv.h'].map(f=>{
    return base
      .then(p=>git.Show(p[1],f).then(file=>mctool.getJson(p[0],file,p[1])(path.join(p[0],f))))
      .then(o=>(o.names.filter(n=>hints.d2i(n.name),1).map(n=>o.defs[n.name].hint=!0),o))
      .then(a=>(a.names=undefined,type='file',a))
      .then(a=>
        (!a.defs['MOTHERBOARD']&&a)||
        base
          .then(p=>mctool.getBoards(path.join(p[0],'Marlin','boards.h')))
          .then(boards=>(Object.assign(a.defs['MOTHERBOARD'],{select:boards,type:"select"}),a))
      )
  });
  return Promise.all(list)
}
app.get('/now/', function (req, res) {
  res.set('Content-Type', 'text/plain');
  get_cfg().then(a=>res.send(JSON.stringify(a,null,2)))
});
app.get('/version', function (req, res) {
  res.set('Content-Type', 'image/svg+xml');
  var badge={
    text:       { name:"marlin-conf", version:pjson.version },
    width:      { text:83, version:39, total:122 },
    position:   { version:88 }
  };

  var file=path.join(__dirname,'..','views','version.html');
  return promisify(fs.readFile)(file,'utf8')
  .then(v=>{
    res.end(v.replace(/{{([\w.]+)}}/g,(m,r)=>r.split('.').reduce((p,o)=>(p=p&&p[o],p),badge)));
  });
});
app.get('/version/:screen', function (req, res) {
  res.set('Content-Type', 'text/plain');
  if (!/\/jes/.test(process.cwd()))
    visitor.screenview(req.params.screen, pjson.name,pjson.version).send()
  pio.isPIO()
//  .then(pio.list)
//  .then(p=>"'"+p+"'")
  .catch(()=>false)
  .then(a=>{
    //console.log(a)
    var s=JSON.stringify(a);
    res.write(`var config={pio:${s},version:"${pjson.version}"};`);
    res.end();
  })
});
function pioRoot(){
  return git.root()
  .then(root=>
    promisify(fs.stat)(path.join(root,'Marlin','platformio.ini'))
    .then(a=>path.join(root,'Marlin'))
    .catch(a=>root)
    .then(root=>(process.chdir(root),root))
  );
}
app.get('/pio', function (req, res) {
  pioRoot()
  .then(root=>
    pio.run(['run'],res)
  );
});
function atob(b64string){
  if ( process.version<"v6.0.0" )
    // Node 5.10+
    return Buffer.from(b64string, 'base64');
  else
    // older Node versions
    return new Buffer(b64string, 'base64');
}

app.get('/pio-flash/:port', function (req, res) {
  var port=atob(req.params.port).toString();
  var params=['run','-t','upload'];
  var close=false;
  if (port[0]=='/'){
    params.push('--upload-port')
    params.push(port)
    close=true;
  }
  (close&&serial_enabled?serial.close(port):Promise.resolve(true))
  .then(pioRoot)
  .then(root=>{
    var cmd=pio.run(params,res);
    req.on('close',function(){
      cmd.kill('SIGINT');
      console.error('flash killed')
    })
  });
});
app.get('/pio-flash', function (req, res) {
  git.root()
  .then(root=>{
    process.chdir(path.join(root,'Marlin'))
    pio.run(['run','-t','upload'],res);
  });
});
app.get('/json/', function (req, res) {
  res.set('Content-Type', 'application/json');
  get_cfg().then(a=>res.send(a))
});
app.get('/status', function (req, res) {
  git.Status().then(a=>res.send(a))
});
app.get('/checkout-force', function (req, res) {
  git.Checkout('--force').then(a=>res.send(a))
});
app.get('/fetch', function (req, res) {
  git.Fetch()
  .then(a=>res.end(JSON.stringify(a)))
  .catch(e=>res.status(403).send(e))
});
app.get('/hint/:name', function (req, res) {
  res.send(hints.hint(req.params.name));
})
app.get('/gcode/:name', function (req, res) {
  res.send(hints.getG(req.params.name));
})
app.get('/gcodes', function (req, res) {
  res.send(hints.listG());//.map(i=>(i.doc=undefined,i)));
})
app.post('/upload', function(req, res){
  //var uploadDir = path.join(__dirname, '/uploads');
  new Promise((done,fail)=>{
    var form = new formidable.IncomingForm();
    form.multiples = true;
    form.parse(req,function(err, fields, files) {
      if ( err )
        return fail(err);
      files=files[Object.keys(files)[0]];
      files=Array.isArray(files)&&files||[files]
      done(files);
    })
  })
  .then(files=>{
    files.map(file=>{
      if (['Configuration.h','Configuration_adv.h'].indexOf(file.name)<0)
        throw 'Wrong file name! Allowed only Configuration.h and Configuration_adv.h';
    })
    return files;
  })
//  .then(a=>(console.log(a),a))
//process
  .then(files=>{
    return Promise.all(files.map(file=>git.root().then(root=>{
try{
        return mctool
          .makeCfg(file.path)
          .then(mctool.makeHfile(root,file.name))
}catch(e) { console.log(e); throw e; }
      })
//        return new Promise((done,fail)=>
//        fs.rename(file.path, path.join(uploadDir, file.name),(err,ok)=>(err&&fail(err)||done(ok))))
    ))
  })
  .then(a=>res.send(a))
//  .then(a=>res.end('success'))
  .catch(e=>res.status(403).send(e))
/*
      res.writeHead(200, {'content-type': 'text/plain'});
      res.write('received upload:\n\n');
      res.end('success');
*/
});
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
function main(noOpn){
  return Promise.resolve()
  .then(()=>hints.init(1))
  .catch(a=>console.error('hints failed'))
  .then(()=>git.root())
  .then(root=>promisify(fs.stat)(path.join(root,'Marlin')))
  .catch(a=>{
    var e=('this git not look like Marlin repository');
    console.error(e);
    throw e;
  })
  .then(serial_enabled?serial_init:a=>a)
//  .catch(a=>console.error('serial failed'))
  .then(()=>getPort(3000))
  .then(port =>new Promise((done,fail)=>{
      server.on('error',function(e){
        fail(e)
      })
      server.listen(port, function () {
        var url='http://localhost:'+port+'/';
        console.log('Marlin config tool started on '+url);
        done(url);
      });
  }))
  .then(url=>(!noOpn&&opn(url),url));
}
module.exports.main=main;
require.main===module && main();
