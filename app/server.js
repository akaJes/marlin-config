var express = require('express');
var bodyParser = require('body-parser');
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
var https = require('https');
var ua = require('universal-analytics');
var promisify = require('./helpers').promisify;
var walk=require('./helpers').walk;
var cam = require('./cam');
var qr = require('qr-image');
var os = require('os');
var ifaces = os.networkInterfaces();
var natUpnp = require('nat-upnp');

var natClient = natUpnp.createClient();
natClient.timeout=10*1000;


function getIP(){
  return Object.keys(ifaces).map(function (ifname) {
    return ifaces[ifname].map(function (iface) {
      if ('IPv4' !== iface.family || iface.internal !== false)
        return;
      return iface.address;
    }).filter(a=>a)[0];
  }).filter(a=>a);
}

var httpPort = 3000;
var httpsPort = 3002;
var server = http.Server(app);
var visitor = ua('UA-99239389-1');
var isElectron=module.parent&&module.parent.filename.indexOf('index.js')>=0;

var baseCfg='Marlin';
var serial;
var serial_enabled = !(isElectron&&process.platform=='darwin');
if (serial_enabled)
  serial = require('./console');

var privateKey  = fs.readFileSync(path.join(__dirname,'..','sslcert','server.key'), 'utf8');
var certificate = fs.readFileSync(path.join(__dirname,'..','sslcert','server.crt'), 'utf8');
var credentials = {key: privateKey, cert: certificate};

var camServer = https.Server(credentials, app);
//camServer.listen(3002);
cam.init(server);
cam.init(camServer);
  Promise.resolve(getPort(httpsPort))
  .then(port =>new Promise((done,fail)=>{
      camServer.on('error',function(e){
        fail(e)
      })
      camServer.listen(port, function () {
        httpsPort=port;
        var url='https://localhost:'+port+'/';
        console.log('Marlin cam started on '+url);
        if(0)
        cam.map(port)
        .then(a=>console.log('mapped'))
        .catch(a=>console.error('not mapped',a))
        done(url);
      });
  }))


app.use('/', express.static(path.join(__dirname,'..', 'static')));
app.use('/libs', express.static(path.join(__dirname,'..', 'node_modules')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.get('/web-qr', function (req, res) {
  res.set('Content-Type', 'image/svg+xml');
  var ip=getIP();
  var qr_svg = qr.image('https://'+ip+':3002/cam/', { type: 'svg' });
  qr_svg.pipe(res);
})

/* UPNP */

app.get('/upnp/open', function (req, res) {
  natClient.portMapping({
    public: httpPort,
    private: httpPort,
    ttl: 0,
    description: 'Marlin-conf public port'
  }, function(err) {
    if (err)
      return res.status(403).send(err)
    natClient.externalIp(function(err, ip) {
      if (err)
        return res.status(403).send(err)
      res.send({ip:ip,port:httpPort});
    });
  });
})
app.get('/upnp/local', function (req, res) {
  res.send({ip:getIP(),port:httpPort});
})
app.get('/upnp/check', function (req, res) {
  natClient.getMappings(function(err, results) {
    if (err)
      return res.status(403).send(err)
    natClient.externalIp(function(err, ip) {
      if (err)
        return res.status(403).send(err)
      res.send(results.filter(i=>i.public.port==httpPort).map(i=>({ip:ip,port:i.public.port})));
    });
  });
})
app.get('/upnp/close', function (req, res) {
  natClient.portUnmapping({
    public: httpPort,
  })
  res.end();
})

/* SERIAL */

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

/* GIT */

app.get('/tags', function (req, res) {
  git.Tags().then(data=>{
    res.send(data);
  });
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
  var list=['Configuration.h','Configuration_adv.h']
  .map(f=>{
    return base
      .then(p=>
          git.Show(p[1],path.join(baseCfg,f))
          .then(file=>mctool.getJson(p[0],file,p[1])(path.join(p[0],'Marlin',f)))
      )
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
app.get('/now/', function (req, res) { //???
  res.set('Content-Type', 'text/plain');
  get_cfg().then(a=>res.send(JSON.stringify(a,null,2)))
});
var unique=a=>a.filter((elem, index, self)=>index == self.indexOf(elem))
app.get('/examples', function (req, res) {
  git.root()
  .then(root=>{
    var ex=path.join(root,'Marlin','example_configurations')
    return walk(ex)
    .then(a=>a.filter(i=>/Configuration(_adv)?\.h/.test(i)))
    .then(a=>a.map(i=>path.parse(path.relative(ex,i)).dir))
    .then(unique)
    .then(a=>(a.unshift('Marlin'),a))
    .then(a=>res.send({current:baseCfg,list:a}))
  })
});
app.get('/set-base/:path', function (req, res) {
  baseCfg=atob(req.params.path).toString();
  if (baseCfg!='Marlin')
    baseCfg=path.join('Marlin','example_configurations',baseCfg);
  res.end();
});
app.get('/status', function (req, res) {
  git.Status().then(a=>res.send(a))
});
app.get('/checkout-force', function (req, res) {
  var cp=baseCfg=='Marlin'?a=>a:a=>
    git.root()
    .then(root=>
      ['Configuration.h','Configuration_adv.h']
      .map(f=>new Promise((done,fail)=>
          fs.createReadStream(path.join(root,baseCfg,f))
          .pipe(fs.createWriteStream(path.join(root,'Marlin',f)).on('finish',done))
        )
      )
    )
  git.Checkout('--force')
  .then(cp)
  .then(a=>res.send(a));
});
app.get('/fetch', function (req, res) {
  git.Fetch()
  .then(a=>res.end(JSON.stringify(a)))
  .catch(e=>res.status(403).send(e))
});

/* VERSION */

app.get('/cert', function (req, res) { //??
  res.set('Content-Type', 'application/x-x509-ca-cert');
  res.set('Content-Disposition','inline; filename="server.der"');
  var file=path.join(__dirname,'sslcert','server.der');
  return promisify(fs.readFile)(file)
  .then(data=>res.send(data))
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
    visitor.screenview({
      cd:req.params.screen,
      an:pjson.name,
      av:pjson.version,
      ua:req.headers['user-agent'],
      ul:req.headers['accept-language'].split(',')[0],
    }).send()
  Promise.all([pio.isPIO().catch(()=>false),git.root()])
  .then(pp=>{
    //console.log(a)
    var cfg={pio:pp[0],version:pjson.version,root:pp[1],base:baseCfg};
    res.write("var config="+JSON.stringify(cfg));
    res.end();
  })
});

/* PIO */

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

/* SNIPPETS */

function getTitle(text){
  var m=text.match(/<title>(.*)<\/title>/)
  return m&&m[1];
}
app.get('/snippets', function (req, res) {
  var ex=path.join(__dirname,'..','views','snippets')
  walk(ex)
  .then(a=>Promise.all(a.map(file=>promisify(fs.readFile)(file,'utf8').then(data=>({data:data,name:path.parse(file).name,title:getTitle(data)})))))
  .then(a=>a.sort(function(a,b){ return b.name>a.name?-1:a.name>b.name?1:0; }))
  .then(a=>res.send(a))
});
function getMatch(reg,data,second){
  var m=reg.exec(data);
  if (second)
    m=reg.exec(data);
  return m[1];
}
app.get('/bs/default', function (req, res) {
  git.root()
  .then(f=>path.join(f,'Marlin','dogm_bitmaps.h'))
  .then(file=>promisify(fs.readFile)(file,'utf8'))
  .then(data=>{
    var second=/\/\/\s*#define\s+START_BMPHIGH/g.test(data);
    var d=getMatch(/start_bmp.*{(([^}]|\r\n?|\n)*)}/g,data,second);
    d=d.replace(/\n/g,'').replace(/ /g,'');
    return {
      width:  getMatch(/#define\s+START_BMPWIDTH\s+(\d*)/g,data,second),
      height: getMatch(/#define\s+START_BMPHEIGHT\s+(\d*)/g,data,second),
      data:   d,
    }
  })
  .then(a=>res.send(a))
  .catch(e=>res.status(403).send(e))
});
app.post('/bs/custom', function (req, res) {
  var name='_Bootscreen.h';
  Promise
  .resolve(path.join(__dirname,'..','views',name))
  .then(file=>promisify(fs.readFile)(file,'utf8'))
  .then(text=>text.replace(/{{([\w.]+)}}/g,(m,r)=>r.split('.').reduce((p,o)=>(p=p&&p[o],p),req.body)))
  .then(file=>git.root().then(p=>promisify(fs.writeFile)(path.join(p,'Marlin',name),file)))
  .then(a=>res.end('writed'))
  .catch(e=>res.status(403).send(e))
});
app.get('/bs/custom', function (req, res) {
  git.root()
  .then(f=>path.join(f,'Marlin','_Bootscreen.h'))
  .then(file=>promisify(fs.readFile)(file,'utf8'))
  .then(data=>{
    var d=getMatch(/{(([^}]|\r\n?|\n)*)}/g,data);
    d=d.replace(/\n/g,'').replace(/ /g,'');
    return {
      width:    getMatch(/#define\s+CUSTOM_BOOTSCREEN_BMPWIDTH\s+(\d*)/g,data),
      height:   getMatch(/#define\s+CUSTOM_BOOTSCREEN_BMPHEIGHT\s+(\d*)/g,data),
      timeout:  getMatch(/#define\s+CUSTOM_BOOTSCREEN_TIMEOUT\s+(\d*)/g,data),
      data:     d,
    }
  })
  .then(a=>res.send(a))
  .catch(e=>res.status(403).send(e))
});

/* HINTS */

app.get('/hint/:name', function (req, res) {
  res.send(hints.hint(req.params.name));
})
app.get('/gcode/:name', function (req, res) {
  res.send(hints.getG(req.params.name));
})
app.get('/gcodes', function (req, res) {
  res.send(hints.listG());//.map(i=>(i.doc=undefined,i)));
})

/* MAIN */

app.get('/json/', function (req, res) {
  res.set('Content-Type', 'application/json');
  get_cfg().then(a=>res.send(a))
});
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
          .then(mctool.makeHfile(root,file.name,baseCfg))
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
  .then(a=>SSEsend('set',req.params))
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
  .then(()=>getPort(httpPort))
  .then(port =>new Promise((done,fail)=>{
      httpPort=port;
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
