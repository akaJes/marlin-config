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
var qr = require('qr-image');
var os = require('os');
var natUpnp = require('nat-upnp');
var moment = require('moment');
var mkdirp = require('mkdirp');
var machineId = require('node-machine-id').machineId;
var yazl = require("yazl");
var yauzl = require("yauzl");
var crypto = require("crypto");
var FormData = require('form-data');
var tmp = require('tmp');

var natClient;
var store='.mct.bak';
var httpPort = 3000;
var httpsPort = 3002;
var server = http.Server(app);
var visitor = ua('UA-99239389-1');
var isElectron=module.parent&&module.parent.filename.indexOf('index.js')>=0;

var baseCfg='Marlin';
var serial;
var serial_enabled = true; //!(isElectron&&process.platform=='darwin');
if (serial_enabled)
  serial = require('./console');

var privateKey  = fs.readFileSync(path.join(__dirname,'..','sslcert','server.key'), 'utf8');
var certificate = fs.readFileSync(path.join(__dirname,'..','sslcert','server.crt'), 'utf8');
var credentials = {key: privateKey, cert: certificate};

var camServer = https.Server(credentials, app);
var ss=require('../rtcmc-v3/Signaling-Server.js');
var ssio=ss(camServer);
ssio.attach(server);

app.use('/', express.static(path.join(__dirname,'..', 'static')));
app.use('/libs', express.static(path.join(__dirname,'..', 'node_modules')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.get('/qr/:url', function (req, res) {
  var url=atob(decodeURI(req.params.url)).toString();
  res.set('Content-Type', 'image/svg+xml');
  var qr_svg = qr.image(url, { type: 'svg' });
  qr_svg.pipe(res);
})

/* UPNP */

function getIP() {
  var ifaces = os.networkInterfaces();
  return Object.keys(ifaces).reduce((p, c) =>
    p.concat(ifaces[c].filter(i => !i.internal && 'IPv4' == i.family).map(i => i.address)), []);
}

app.get('/upnp/open', function (req, res) {
  promisify('portMapping', natClient)({
    public: httpPort,
    private: httpPort,
    ttl: 0,
    description: 'Marlin-conf public port'
  })
  .then(a => promisify('externalIp', natClient)())
  .then(ip => res.send({ip: ip, port: httpPort}))
  .catch(e => res.status(403).send(e));
})
app.get('/upnp/local', function (req, res) {
  res.send({ip:getIP()[0],port:httpPort,https:httpsPort});
})
app.get('/upnp/check', function (req, res) {
  Promise.all([
    promisify('getMappings', natClient)(),
    promisify('externalIp', natClient)()
  ])
  .then(p => p[0].filter(i => i.public.port == httpPort).map(i => ({ip: p[1], port: i.public.port})))
  .then(data => (data.length && console.log('Opened external access at http://' + data[0].ip + ':' + data[0].port, '!!!'), data))
  .then(data => res.send(data))
  .catch(e => res.status(403).send(e));
})
app.get('/upnp/close', function (req, res) {
  promisify('portUnmapping', natClient)({
    public: httpPort,
  })
  .then(data => res.send())
  .catch(e => res.status(403).send(e));
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
  return serial.changesPoll().then(monitor=>{
    monitor.on("created", function (f, stat) {
      SSEsend('created',f)
    })
    monitor.on("deleted", function (f, stat) {
      SSEsend('deleted',f)
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
app.get('/branches', function (req, res) {
  git.Branches().then(data=>{
    res.send(data);
  });
});
app.get('/checkout/:branch', function (req, res) {
  return Promise.resolve(atob(decodeURI(req.params.branch)).toString())
  .then(a=>(console.log(a),a))
  .then(git.Checkout)
  .then(data=>{
    res.send(data)
  })
  .catch(a=>res.status(403).send(a))
});
var getBoards = () =>
  seek4File('boards.h', [ 'Marlin', path.join('Marlin', 'src', 'core')])
  .then(mctool.getBoards);

var get_cfg=()=>{
  var base=Promise.all([git.root(),git.Tag()]);
  var setBoards = a => getBoards()
    .then(a => JSON.stringify(a.list))
    .catch(e => '' )
    .then(boards => (Object.assign(a.defs['MOTHERBOARD'], {select: boards, type:"select"}), a));
  var list=['Configuration.h','Configuration_adv.h']
  .map(f => base
      .then(p=>
          git.Show(p[1], path.join(baseCfg, f)).catch(e => git.Show(p[1], path.join('Marlin', f)))
          .then(file=>mctool.getJson(p[0],file,p[1])(path.join(p[0],'Marlin',f)))
      )
      .then(o=>(o.names.filter(n=>hints.d2i(n.name),1).map(n=>o.defs[n.name].hint=!0),o))
      .then(a => Object.assign(a, {names: undefined, type: 'file'}))
      .then(a => a.defs['MOTHERBOARD'] && setBoards(a) || a)
  );
  return Promise.all(list)
}

var unique=a=>a.filter((elem, index, self)=>index == self.indexOf(elem))
var ex_dir = (rel) => seek4File('', [path.join('Marlin', 'example_configurations'), path.join('Marlin', 'src', 'config', 'examples')], rel)
app.get('/examples', function (req, res) {
    var ex;
    return ex_dir()
    .then(dir => (ex = dir))
    .then(walk)
    .then(a=>a.filter(i=>/Configuration(_adv)?\.h/.test(i)))
    .then(a=>a.map(i=>path.parse(path.relative(ex,i)).dir))
    .then(unique)
    .catch(e => [])
    .then(a=>(a.unshift('Marlin'),a))
    .then(a=>res.send({current:baseCfg,list:a}))
});
app.get('/set-base/:path', function (req, res) {
  return Promise.resolve(atob(decodeURI(req.params.path)).toString())
    .then(base => base == 'Marlin' && base || ex_dir(1).then(ex => path.join(ex, base)) )
    .then(base => res.send(baseCfg = base))
});
app.get('/status', function (req, res) {
  git.Status().then(a=>res.send(a))
});
app.get('/checkout-force', function (req, res) {
  var cp = () => git.root()
    .then(root => Promise.all(
      ['Configuration.h', 'Configuration_adv.h', '_Bootscreen.h']
      .map(f=>new Promise((done,fail)=>
          fs.createReadStream(path.join(root, baseCfg, f)).on('error', fail)
          .pipe(fs.createWriteStream(path.join(root, 'Marlin', f)).on('finish', done))
        ).catch(e => 'not found')
      )
    ))
  var rm = () =>
    seek4File('_Bootscreen.h', [path.join('Marlin', 'src', 'config'), 'Marlin'])
    .then(file => file && promisify(fs.unlink)(file))
    .catch(a=>a);

  git.Checkout('--force')
  .then(rm)
  .then(a => baseCfg == 'Marlin' ? a : cp())
  .then(a=>res.send(a))
  .catch(e=>res.status(403).send(e))
});
app.get('/fetch', function (req, res) {
  git.Fetch()
  .then(a=>res.end(JSON.stringify(a)))
  .catch(e=>res.status(403).send(e))
});

/* SAVE */
var copyFile=(from,to)=>
  new Promise((done,fail)=>
    fs.createReadStream(from)
    .on('error',fail)
    .pipe(
      fs.createWriteStream(to)
      .on('finish',()=>done(to))
      .on('error',fail)
    )
  );

const configFiles = p => Promise.all(
    ['Configuration.h', 'Configuration_adv.h', '_Bootscreen.h']
      .map(file => seek4File(file, p ? [p.replace(/\\/g, path.sep)] : ['Marlin', path.join('Marlin', 'src', 'config')]).catch(() => null))
  ).then(files => files.filter(a => a));

app.get('/save', function (req, res) {
  var dt=moment().format('YYYY-MM-DD kk-mm-ss');
    Promise.all([git.root(), git.Tag()])
    .then(p => {
      var dir = path.join(p[0], store, p[1].replace('/', path.sep), dt);
      return promisify(mkdirp)(dir).then(a => ({to: dir, root: p[0]}));
    })
    .then(dirs => configFiles()
      .then(files => Object.assign(dirs, {files: files, message: req.query.message}))
    )
    .then(dirs=>
      Promise.all(dirs.files.map(f => copyFile(f, path.join(dirs.to, path.basename(f)))))
      .then(()=>dirs)
    )
    .then(dirs=>promisify(fs.writeFile)(path.join(dirs.to,'contents.json'),JSON.stringify(dirs,null,2)).then(()=>dirs))
    .then(a=>(console.log('stat',a),a))
    .then(dirs=>res.send(dirs))
    .catch(e => res.status(403).send(e))
});
var pubs = {};
app.get('/publish/:path', function (req, res) {
  var name = atob(decodeURI(req.params.path)).toString();
  var ses = crypto.createHash('md5').update((new Date()).toJSON()).digest("hex");
  var obj = pubs[ses] = {session: ses, name: name, description: '', };
  configFiles(name != 'Marlin' && path.join(store, name))
  .then(files => (obj.files = files).filter(i => /Configuration/.test(i))[0])
  .then(file => Promise.all([promisify(fs.readFile)(file, 'utf8'), git.Tag(), getBoards().catch(e => [] )]))
  .then(p => {
    res.set('Access-Control-Allow-Origin', '*');
    obj.motherboard = (m => m && m[1])(p[0].match(/\s*#define\s+MOTHERBOARD\s+(\w*)/));
    obj.author = (m => m && m[1])(p[0].match(/#define\s+STRING_CONFIG_H_AUTHOR\s+"(.*)"/));
    obj.version = p[1];
    obj.motherboardId = p[2].objs.filter(i => i.name == obj.motherboard)[0].value;
    return obj;
  })
  .then(a => res.send(a))
  .catch(e => res.status(403).send(e))
});
app.post('/publicate', function (req, res) {
  new Promise((resolve, reject) => {
  try{
    var obj = pubs[req.body.session];
    if (!obj)
      return reject('session');
    Object.assign(obj, req.body);
    var zip = new yazl.ZipFile();
    obj.files.map(file => zip.addFile(file, path.basename(file)))
    zip.end();
    var tmpobj = tmp.fileSync();
    console.log('File: ', tmpobj.name); // npm/formidable cant recieve native streams !!!
    zip.outputStream.pipe(fs.createWriteStream(tmpobj.name))
    .on("close", function() {
      var form = new FormData();
      form.append('params', JSON.stringify(obj));
      form.append('file', fs.createReadStream(tmpobj.name));
      form.submit('http://lt.rv.ua/mc/s/post', function(err, res) {
        if (err) reject(err);
        resolve(res.statusCode);
        console.log(res.statusCode);
      });
    });
  }catch(e){ throw e }
  })
  .then(a => res.send(a))
  .catch(e=>res.status(403).send(e))
});
var fetchStream = res =>
  new Promise((resolve, reject) => {
    var data = [];
    res.on('data', function(chunk) {
      data.push(chunk);
    }).on('end', function() {
      resolve(Buffer.concat(data));
    });
  })
var readZip = zip =>
  new Promise((resolve, reject) => {
    var files = [];
    zip.readEntry();
    zip.on("entry", function(entry) {
      if (/\/$/.test(entry.fileName))
        zip.readEntry();
      else {
        // file entry
        promisify('openReadStream', zip)(entry)
          .then(fetchStream)
          .then(file => {
            files.push({entry: entry, file: file});
            zip.readEntry();
          })
      }
    })
    zip.on("end", function(){
      resolve(Promise.all(files))
    });
  });
var httpGet = url =>
  new Promise((resolve, reject) => {
    http.get(url, function(res) {
      resolve(res);
    });
  })
app.get('/site/:Id', function (req, res) {
  var url = 'http://lt.rv.ua/mc/s/getzip/' + req.params.Id;
  httpGet(url)
  .then(fetchStream)
  .then(buf => promisify(yauzl.fromBuffer)(buf, {lazyEntries:true}))
  .then(readZip)
  .then(files => files.map(i => ({path: i.file, name: i.entry.fileName})))
  .then(uploadFiles)
  .then(a => (SSEsend('reload'),"page/application reloaded"))
  .then(a => res.send(a))
  .catch(e => (console.error(e),res.status(403).send(e)))
});
app.get('/zip/:path', function (req, res) {
  var name = atob(decodeURI(req.params.path)).toString();
  Promise.all([configFiles(name != 'Marlin' && path.join(store, name)), git.Tag()])
  .then(p => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Disposition', 'attachment; filename="Marlin-' + (name != 'Marlin' && name || p[1]).replace('/', '-') + '.zip"');
    var zip = new yazl.ZipFile();
    zip.outputStream.pipe(res);
    p[0].map(file => zip.addFile(file, path.basename(file)))
    zip.end();
  })
  .catch(e=>res.status(403).send(e))
});
var recurseObj=(obj,p)=>{
  p=p||'';
  var arr=[];
  Object.keys(obj).forEach(function(key) {
    var ob={text:key,path:path.join(p,key)},nodes=recurseObj(obj[key],ob.path);
    if (nodes.length){
      ob.nodes=nodes;
      ob.state={expanded:false};
    }
    arr.push(ob);
  });
  return arr;
}
app.get('/restore/:path', function (req, res) {
  var p=atob(decodeURI(req.params.path)).toString();
  git.root()
  .then(root=>path.join(root,store,p))
  .then(dir=>promisify(fs.stat)(dir).catch(a=>{throw 'no files';}).then(a=>dir))
  .then(walk)
  .then(files=>{
    var up=files
    .filter(i=>/Configuration(_adv)?\.h/.test(i))
    .map(f=>({path:f,name:path.parse(f).base}))
    var cp=files
    .filter(i=>/_Bootscreen\.h/.test(i))
    .map(f =>
      seek4File('', [path.join('Marlin', 'src', 'config'), 'Marlin'])
      .then(dir => copyFile(f, path.join(dir, path.basename(f) )))
    )
    console.log(cp);
    //return (uploadFiles(up));
    return uploadFiles(up).then(up=>Promise.all([...up,...cp]));
  })
  .then(a=>res.send(a))
  .catch(e=>res.status(403).send(e))
});
app.get('/saved', function (req, res) {
  git.root()
  .then(root=>{
    var ex=path.join(root,store);
    return Promise.resolve(ex)
    .then(dir=>promisify(fs.stat)(dir).catch(a=>{throw 'no files';}).then(a=>dir))
    .then(walk)
    .then(a=>a.filter(i=>/Configuration(_adv)?\.h/.test(i)))
    .then(a=>a.map(i=>path.parse(path.relative(ex,i)).dir))
    .then(unique)
    .then(a=>
      Promise.all(
        a.map(dir=>
          promisify(fs.stat)(path.join(ex,dir,'contents.json'))
          .then(a=>promisify(fs.readFile)(path.join(ex,dir,'contents.json'),'utf8'))
          .then(text=>({dir:dir,content:JSON.parse(text)}))
          .catch(()=>({dir:dir}))
        )
      )
    )
    .then(a=>{
      var obj={},info={};
      a.forEach(ia=>ia.dir.split(path.sep).reduce((p,a)=>(p[a]=p[a]||{},p[a]),obj))
      a.forEach(ia=>(info[ia.dir]={message:ia.content.message}))
      return {tree:recurseObj(obj),info:info};
    })
    .then(a=>res.send(a))
    .catch(e=>res.status(403).send(e))
  })
});

/* VERSION */

app.get('/version', function (req, res) {
  res.set('Content-Type', 'image/svg+xml');
  var badge={
    text:       { name:pjson.name, version:pjson.version },
    width:      { text: 83, version: 45 },
    position:   { version:88 }
  };
  badge.width.total = badge.width.text + badge.width.version;

  var file=path.join(__dirname,'..','views','version.html');
  return promisify(fs.readFile)(file,'utf8')
  .then(v=>{
    res.end(v.replace(/{{([\w.]+)}}/g,(m,r)=>r.split('.').reduce((p,o)=>(p=p&&p[o],p),badge)));
  });
});
var pioEnv = (file) =>
  promisify(fs.readFile)(file, 'utf8')
  .then(a=>a.split(/\r\n?|\n/))
  .then(a=>a.map(i=>i.match(/\[env\:(.*)\]/)).filter(i=>i).map(i=>i[1]))

app.get('/version/:screen', function (req, res) {
  machineId()
  .then(id =>
    visitor.screenview({
      cd:req.params.screen,
      an:pjson.name+(isElectron&&"-electron"||''),
      av:pjson.version,
      ua:req.headers['user-agent'],
      cid: id,
      ul:req.headers['accept-language'].split(',')[0],
    }).send()
  )
  Promise.all([pio.isPIO().catch(() => false), git.root(), pioRoot().then(pioEnv).catch(e => [])])
  .then(pp => {
    var cfg={pio:pp[0],version:pjson.version,root:pp[1],base:baseCfg,env:pp[2]};
    res.set('Content-Type', 'application/javascript').send("var config = " + JSON.stringify(cfg));
  })
});

/* PIO */

function pioRoot(){
  return seek4File('platformio.ini', ['', 'Marlin'])
}
app.get('/pio/:env', function (req, res) {
  var params = ['run'];
  if (req.params.env != 'Default')
    params.push('-e', req.params.env);
  pioRoot().then(file => pio.run(params, res, path.dirname(file)));
});
function atob(b64string) {
  if ( process.version<"v6.0.0" )
    return Buffer.from(b64string, 'base64');
  else
    return new Buffer(b64string, 'base64');
}

app.get('/pio/:env/:port', function (req, res) {
  var port=atob(decodeURI(req.params.port)).toString();
  var params=['run','-t','upload'];
  var close=port!='Default';
  if (req.params.env!='Default')
    params.push('-e',req.params.env);
  if (close)
    params.push('--upload-port',port)
  console.log(); //if removed - process hangs :)
  (close&&serial_enabled?serial.close(port):Promise.resolve(true))
  .then(pioRoot)
  .then(file => {
    var cmd = pio.run(params, res, path.dirname(file));
    req.on('close',function(){
      cmd.kill('SIGINT');
      console.error('flash killed')
    })
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
  return seek4File('dogm_bitmaps.h', ['Marlin', path.join('Marlin', 'src', 'lcd', 'dogm')])
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
  Promise.all([
    seek4File('', [path.join('Marlin', 'src', 'config'), 'Marlin']),
    promisify(fs.readFile)(path.join(__dirname, '..', 'views', name), 'utf8')
    .then(text => text.replace(/{{([\w.]+)}}/g, (m, r) => r.split('.').reduce((p, o) => (p = p && p[o], p), req.body)))
  ])
  .then(p => promisify(fs.writeFile)(path.join(p[0], name), p[1]))
  .then(a=>res.end('writed'))
  .catch(e=>res.status(403).send(e))
});
app.get('/bs/custom', function (req, res) {
  seek4File('_Bootscreen.h', [ 'Marlin', path.join('Marlin', 'src', 'config')])
  .then(file => promisify(fs.readFile)(file, 'utf8'))
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

function getFirstFile(paths) {
  if (!paths || paths.length == 0)
    return Promise.reject();
  var filePath = paths.shift();
  return promisify(fs.access)(filePath, fs.constants.R_OK)
    .then(a => filePath)
    .catch(e => getFirstFile(paths) );
}
function seek4File(file, paths, rel) {
  return git.root().then(root => getFirstFile(paths.map(i => path.join(root, i, file))).then(res => rel && path.relative(root, res) || res))
}

app.get('/json/', function (req, res) {
  res.set('Content-Type', 'application/json');
  get_cfg().then(a=>res.send(a))
});

var uploadFiles=files=>
  Promise.all(files.map(file=>
    git.root()
    .then(root=>{
      try{
        return mctool
          .makeCfg(file.path)
          .then(mctool.makeHfile(root,file.name,baseCfg))
          .then(a=>file.name)
      }catch(e){
        console.log(e);
        throw e;
      }
    })
  ))

app.post('/upload', function(req, res){
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
  .then(uploadFiles)
  .then(a=>res.send(a))
  .catch(e=>res.status(403).send(e))
});
app.post('/set/:file/:name/:prop/:value', function (req, res) {
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  var name = req.params.name.split('.');
  var ob = {name: name[0]};
  var set = (prop, val) => ob[prop] = (prop == 'disabled' ? val == 'true' : val);
  name.length > 1 && set('number', parseInt(name[1]));
  set(req.params.prop, req.params.value);
  return git.root()
  .then(root => mctool.updateH(root, path.join(root, 'Marlin', req.params.file + '.h'), [ob]))
  .then(a => Object.assign(req.params, {ip: ip}))
  .then(data => (res.send(data), SSEsend('set', data)))
  .catch(a=>res.status(403).send(a))
})
var serve = (http, port) =>
  new Promise((resolve, reject) => {
    http.on('error', reject);
    http.listen(port, function () {
      resolve(port);
    });
  })
function main(noOpn) {
  natClient = natUpnp.createClient();
  natClient.timeout = 10*1000;
  return git.root()
    .then(root => promisify(fs.stat)(path.join(root, 'Marlin')))
    .catch(e => {
      var e = 'this git not look like Marlin repository';
      console.error(e);
      throw new Error(e);
    })
    .then(a => Promise.all([
        hints.init(1).catch(a => console.error('hints failed')),
        serial_enabled && serial_init(),
        getPort(httpsPort).then(port => serve(camServer, port))
          .then(port => (httpsPort = port, 'https://localhost:' + port + '/')),
        getPort(httpPort).then(port => serve(server, port))
          .then(port => (httpPort = port, 'http://localhost:' + port + '/')),
      ])
    )
    .then(p => {
      console.log('Marlin config started at:', '[ service =>', p[3], '] [ cam =>', p[2], ']');
      !noOpn && opn(p[3]);
      return p[3];
    })
}
module.exports.main=main;
require.main===module && main();
