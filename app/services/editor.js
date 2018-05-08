const router = module.exports = require('express').Router();
const git = require('../git-tool');
const path = require('path');
const promisify = require('../helpers').promisify;
const fs = require('fs');

router.get('/tree', function(req, res) {
  var dir = req.query.dir.replace(/\.\./g, '');
  git.root()
  .then(root => {
    var folder = path.join(root, dir);
    return promisify(fs.readdir)(folder)
    .then(list => Promise.all(list.map(file => promisify(fs.stat)(path.join(folder, file)).then(stats => ({stats: stats, name: file})))))
  })
  .then(list => list.map(i => ({children: i.stats.isDirectory(), icon: (i.stats.isDirectory() ? "" : "jstree-file"), id: path.join(dir, i.name), text: i.name})))
//  .catch(e => console.error(e))
  .catch(e => res.status(501).send(e))
  .then(data => res.send(data))
})

router.get('/files/*', function(req, res) {
  git.root()
  .then(root => promisify(fs.readFile)(path.join(root, req.originalUrl.replace(/.*files\//, ''))))
//  .catch(e => console.error(e))
  .catch(e => res.status(501).send(e))
  .then(data => res.send(data))
})

router.get('/git/*', function(req, res) {
  git.Tag()
  .then(tag => git.Show(tag, req.originalUrl.replace(/.*git\//, '')))
  .catch(e => console.error(e))
  .catch(e => res.status(501).send(e))
  .then(data => res.send(data))
})
