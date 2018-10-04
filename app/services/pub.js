const http = require('http');
const crypto = require("crypto");
const path = require('path');
const fs = require('fs');
const tmp = require('tmp');

const yazl = require("yazl");
const yauzl = require("yauzl");
const router = module.exports = require('express').Router();
const FormData = require('form-data');

const git = require('../git-tool');
const store = require('../store');
const {promisify, atob, walk} = require('../helpers');
const {seek4File, configFiles, getBoards, uploadCopyFiles} = require('../common');

var pubs = {};

router.get('/publish/:path', function (req, res) {
  var name = atob(decodeURI(req.params.path)).toString();
  var ses = crypto.createHash('md5').update((new Date()).toJSON()).digest("hex");
  var obj = pubs[ses] = {session: ses, name: name, description: '', };
  configFiles(name != 'Marlin' && path.join(store.config.store, name))
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

router.post('/publicate', function (req, res) {
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

router.get('/site/:Id', function (req, res) {
  var url = 'http://lt.rv.ua/mc/s/getzip/' + req.params.Id;
  httpGet(url)
  .then(fetchStream)
  .then(buf => promisify(yauzl.fromBuffer)(buf, {lazyEntries:true}))
  .then(readZip)
  .then(files => files.map(i => ({path: i.file, name: i.entry.fileName})))
  .then(uploadCopyFiles)
  .then(a => (store.mods.sse.send('reload'),"page/application reloaded"))
  .then(a => res.send(a))
  .catch(e => (console.error(e),res.status(403).send(e)))
});
