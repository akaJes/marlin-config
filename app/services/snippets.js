const router = module.exports = require('express').Router();
const path = require('path');
const fs = require('fs');
const {walk, promisify} = require('../helpers')
const {seek4File} = require('../common')

function getTitle(text) {
  var m = text.match(/<title>(.*)<\/title>/)
  return m && m[1];
}

router.get('/snippets', function (req, res) {
  var ex = path.join(__dirname, '..', '..', 'views', 'snippets')
  walk(ex)
  .then(a => Promise.all(a.map(file => promisify(fs.readFile)(file, 'utf8').then(data => ({data: data, name: path.parse(file).name, title: getTitle(data)})))))
  .then(a => a.sort(function(a, b) {return b.name > a.name ? -1 : a.name > b.name ? 1 : 0;}))
  .then(a => res.send(a))
});

function getMatch(reg, data, second) {
  var m = reg.exec(data);
  if (second)
    m = reg.exec(data);
  return m[1];
}

router.get('/bs/default', function (req, res) {
  return seek4File('dogm_bitmaps.h', ['Marlin', path.join('Marlin', 'src', 'lcd', 'dogm')])
  .then(file => promisify(fs.readFile)(file, 'utf8'))
  .then(data => {
    var second = /\/\/\s*#define\s+START_BMPHIGH/g.test(data);
    var d = getMatch(/start_bmp.*{(([^}]|\r\n?|\n)*)}/g, data, second);
    d = d.replace(/\n/g, '').replace(/ /g, '');
    return {
      width: getMatch(/#define\s+START_BMPWIDTH\s+(\d*)/g, data, second),
      height: getMatch(/#define\s+START_BMPHEIGHT\s+(\d*)/g, data, second),
      data: d,
    }
  })
  .then(a => res.send(a))
  .catch(e => res.status(403).send(e))
});

router.post('/bs/custom', function (req, res) {
  var name = '_Bootscreen.h';
  Promise.all([
    seek4File('', [path.join('Marlin', 'src', 'config'), 'Marlin']),
    promisify(fs.readFile)(path.join(__dirname,'..',  '..', 'views', name), 'utf8')
    .then(text => text.replace(/{{([\w.]+)}}/g, (m, r) => r.split('.').reduce((p, o) => (p = p && p[o], p), req.body)))
  ])
  .then(p => promisify(fs.writeFile)(path.join(p[0], name), p[1]))
  .then(a => res.end('writed'))
  .catch(e => res.status(403).send(e))
});

router.get('/bs/custom', function (req, res) {
  seek4File('_Bootscreen.h', [ 'Marlin', path.join('Marlin', 'src', 'config')])
  .then(file => promisify(fs.readFile)(file, 'utf8'))
  .then(data => {
    var d = getMatch(/{(([^}]|\r\n?|\n)*)}/g, data);
    d=d.replace(/\n/g, '').replace(/ /g, '');
    return {
      width:    getMatch(/#define\s+CUSTOM_BOOTSCREEN_BMPWIDTH\s+(\d*)/g, data),
      height:   getMatch(/#define\s+CUSTOM_BOOTSCREEN_BMPHEIGHT\s+(\d*)/g, data),
      timeout:  getMatch(/#define\s+CUSTOM_BOOTSCREEN_TIMEOUT\s+(\d*)/g, data),
      data:     d,
    }
  })
  .then(a => res.send(a))
  .catch(e => res.status(403).send(e))
});
