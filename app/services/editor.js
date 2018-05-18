const router = module.exports = require('express').Router();
const git = require('../git-tool');
const store = require('../store').mods.editor;
const path = require('path');
const promisify = require('../helpers').promisify;
const fs = require('fs');
const formidable = require('formidable');

const safePath = val => decodeURI(val).replace(/|\.\.|\/\//g, '');
const getRoot = req => Promise.resolve(store.root(req))

//create
router.post('/file/*', (req, res) => {
  const f = req.query.type == 'file';
  const p = safePath(req.url.slice(5));
  return getRoot(req)
  .then(root => promisify(f && fs.writeFile || fs.mkdir)(path.join(root, p), f ? '' : 0o777)) //TODO: check if exists
  .then(a => ({id: p}))
  .catch(e => res.status(501).send(e.message))
  .then(data => res.send(data))
})

//remove
router.delete('/file/*', (req, res) => {
  const p = safePath(req.url.slice(5));
  return getRoot(req)
  .then(root => promisify(fs.stat)(path.join(root, p)).then(stats => promisify(stats.isDirectory() ? fs.rmdir : fs.unlink)(path.join(root, p)) ))
  .then(a => ({id: p}))
  .catch(e => res.status(501).send(e.message))
  .then(data => res.send(data))
})

//move //TODO check if destenation not exists ?
router.put('/file/*', (req, res) => {
  const p = safePath(req.url.slice(5));
  const t = safePath(req.body.to);
  return getRoot(req)
  .then(root => promisify(fs.rename)(path.join(root, p), path.join(root, t)))
  .then(a => ({id: t}))
  .catch(e => res.status(501).send(e.message))
  .then(data => res.send(data))
})

//TODO:copy

//list
router.get('/tree', function(req, res) {
  var dir = req.query.id == '#' && '/' || req.query.id || '';
  dir = dir.replace(/\.\./g, '');
  return getRoot(req)
  .then(root => promisify(fs.readdir)(path.join(root, dir))
    .then(list => list.filter(name => name && (name != '.' || name != '..')))
    .then(list => Promise.all(list.map(name => promisify(fs.stat)(path.join(root, dir, name))
      .then(stats => ({
        children: stats.isDirectory(),
        type: stats.isDirectory() ? 'default' : "file",
        text: name,
        id: path.join(dir, name),
//        icon: stats.isDirectory() ? 'jstree-folder' : "jstree-file",
      }))))
    )
  )
  .then(list => dir != '/' && list || {text: store.name(req), children: list, id: '/', type: 'default', state: {opened: true, disabled: true}})
  .catch(e => res.status(501).send(e.message))
  .then(data => res.send(data))
})

//content
router.get('/file/*', function(req, res) {
  const p = safePath(req.url.slice(5));
  return getRoot(req)
  .then(root => promisify(fs.stat)(path.join(root, p)).then(stats => !stats.isDirectory() && promisify(fs.readFile)(path.join(root, p)) || '' ))
  .catch(e => res.status(501).send(e.message))
  .then(data => res.send(data))
})

const parseForm = req => new Promise((resolve, reject) => {
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
      return err && reject(err) || resolve([fields, files]);
    })
  })

router.post('/upload/*', function(req, res) {
  const p = safePath(req.url.slice(7));
  return getRoot(req)
  .then(root => parseForm(req).then(ff => promisify(fs.rename)(ff[1].data.path, path.join(root, p)).then(a => p) ))
  .catch(e => res.status(501).send(e.message))
  .then(data => res.send(data))
 });


//git file TODO: git for multiproject
router.get('/git/*', function(req, res) {
  git.Tag()
  .then(tag => git.Show(tag, req.originalUrl.replace(/.*git\//, '')).catch(a=>''))
  .catch(e => res.status(501).send(e.message))
  .then(data => res.send(data))
})
