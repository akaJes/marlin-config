const path = require('path');
const fs = require('fs');

const router = module.exports = require('express').Router();
const moment = require('moment');
const mkdirp = require('mkdirp');
const yazl = require("yazl");

const git = require('../git-tool');
const {promisify, atob, walk, unique} = require('../helpers');
const {seek4File, configFiles, getBoards, uploadCopyFiles, copyFile} = require('../common');
const store = require('../store');

router.get('/save', function (req, res) {
    var dt = moment().format('YYYY-MM-DD kk-mm-ss');
    Promise.all([git.root(), git.Tag()])
    .then(p => {
      var dir = path.join(p[0], store.config.store, p[1].replace('/', path.sep), dt);
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

router.get('/zip/:path', function (req, res) {
  var name = atob(decodeURI(req.params.path)).toString();
  Promise.all([configFiles(name != 'Marlin' && path.join(store.config.store, name)), git.Tag()])
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

router.get('/restore/:path', function (req, res) {
  var p=atob(decodeURI(req.params.path)).toString();
  git.root()
  .then(root => path.join(root, store.config.store, p))
  .then(dir=>promisify(fs.stat)(dir).catch(a=>{throw 'no files';}).then(a=>dir))
  .then(walk)
  .then(files => uploadCopyFiles(files.map(f => ({path: f, name: path.parse(f).base}))))
  .then(a=>res.send(a))
  .catch(e=>res.status(403).send(e))
});

router.get('/saved', function (req, res) {
  git.root()
  .then(root=>{
    var ex = path.join(root, store.config.store);
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
