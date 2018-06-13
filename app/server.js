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
const {promisify, atob, walk, unique} = require('./helpers');
const {seek4File, copyFile, uploadFiles, configFiles, getBoards, getThermistors} = require('./common');
var qr = require('qr-image');
var machineId = require('node-machine-id').machineId;

const store = require('./store');
store.mods.editor && (store.mods.editor.root = () => git.root())

var server = http.Server(app);
var visitor = ua('UA-99239389-1');
var isElectron=module.parent&&module.parent.filename.indexOf('index.js')>=0;


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

var get_cfg=()=>{
  var base=Promise.all([git.root(),git.Tag()]);
  var setBoards = a => getBoards()
    .then(boards => (Object.assign(a.defs['MOTHERBOARD'], {select: boards.select, type:"select"}), a));
  var setThermistors = defs => getThermistors()
    .then(a => {
      Object.keys(defs.defs)
        .filter(i => /^TEMP_SENSOR/.test(i))
        .map(i => Object.assign(defs.defs[i], {select: a.select, type: "select"}))
      return defs;
    })
  var list=['Configuration.h','Configuration_adv.h']
  .map(f => base
      .then(p=>
          git.Show(p[1], path.join(store.vars.baseCfg, f)).catch(e => git.Show(p[1], path.join('Marlin', f)))
          .then(file=>mctool.getJson(p[0],file,p[1])(path.join(p[0],'Marlin',f)))
      )
      .then(o=>(o.names.filter(n=>hints.d2i(n.name),1).map(n=>o.defs[n.name].hint=!0),o))
      .then(a => Object.assign(a, {names: undefined, type: 'file'}))
      .then(a => 'MOTHERBOARD' in a.defs ? setBoards(a).then(setThermistors) : a)
  );
  return Promise.all(list)
}

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
    .then(a => res.send({current: store.vars.baseCfg, list: a}))
});

app.get('/set-base/:path', function (req, res) {
  return Promise.resolve(atob(decodeURI(req.params.path)).toString())
    .then(base => base == 'Marlin' && base || ex_dir(1).then(ex => path.join(ex, base)) )
    .then(base => res.send(store.vars.baseCfg = base))
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
    var cfg = {pio: pp[0], version: pjson.version, root: pp[1], base: store.vars.baseCfg, env: pp[2]};
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

app.get('/pio/:env/:port', function (req, res) {
  var port=atob(decodeURI(req.params.port)).toString();
  var params=['run','-t','upload'];
  var close=port!='Default';
  if (req.params.env!='Default')
    params.push('-e',req.params.env);
  if (close)
    params.push('--upload-port',port)
  console.log(); //if removed - process hangs :)
  (close && store.mods.serial ? store.mods.serial.close(port) : Promise.resolve(true))
  .then(pioRoot)
  .then(file => {
    var cmd = pio.run(params, res, path.dirname(file));
    req.on('close',function(){
      cmd.kill('SIGINT');
      console.error('flash killed')
    })
  });
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
  set(req.params.prop, atob(decodeURI(req.params.value)).toString());
  return git.root()
  .then(root => mctool.updateH(root, path.join(root, 'Marlin', req.params.file + '.h'), [ob]))
  .then(a => Object.assign(req.params, {ip: ip}))
  .then(data => (res.send(data), store.mods.sse.send('set', data)))
  .catch(a=>res.status(403).send(a))
})

app.use('/', require('./services'));

require('./services/ot').init(server, '/ws');

var serve = (http, port) =>
  new Promise((resolve, reject) => {
    http.on('error', reject);
    http.listen(port, function () {
      resolve(port);
    });
  })
function main(noOpn) {
  return git.root()
    .then(root => promisify(fs.stat)(path.join(root, 'Marlin')))
    .catch(e => {
      var e = 'this git not look like Marlin repository';
      console.error(e);
      throw new Error(e);
    })
    .then(a => Promise.all([
        hints.init(1).catch(a => console.error('hints failed')),
        store.mods.serial && store.mods.serial.ctor(server),
        getPort(store.vars.httpsPort).then(port => serve(camServer, port))
          .then(port => (store.vars.httpsPort = port, 'https://localhost:' + port + '/')),
        getPort(store.vars.httpPort).then(port => serve(server, port))
          .then(port => (store.vars.httpPort = port, 'http://localhost:' + port + '/')),
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
