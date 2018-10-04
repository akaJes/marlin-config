'use strict';
const {app, BrowserWindow, Menu, dialog, ipcMain} = require('electron');
//require('electron-debug')({showDevTools: true, enabled: true}); //runtime debug
console.log('Node',process.version);
const notifier = require('node-notifier');

var which=require('which');
var path=require('path');
var fs = require('fs');
var promisify = require('./app/helpers').promisify;
var git = require('./app/git-tool');
var server = require('./app/server');
const store = require('data-store')('marlin-config');
const pio  = require('./app/pio-inst');
const gitExe = 'git';

var mainWindow = null;
var getFolder=()=>new Promise((done,fail)=>
    dialog.showOpenDialog({
      title:'select folder with Marlin Firmware or empty folder to clone it',
      properties:['openDirectory'],
    },function(folders){
      console.log(); //without this - it hangs
      if (!folders)
        return fail({type:'fatal',message:'no folder selected'});
      done(folders[0])
    })
  )
app.on('window-all-closed', () => {
  console.log('window-all-closed');
  app.quit()
})
function showNotify(text){
  notifier.notify({
    title: 'marlin-conf electron version',
    message: text,
    icon: path.join(__dirname, 'build/icons/icon_256x256.png'), // Absolute path (doesn't work on balloons)
    sound: true, // Only Notification Center or Windows Toasters
    wait: true // Wait with callback, until user action is taken against notification
  });
}
ipcMain.on('search-text', (event, arg) => {
  var wc = mainWindow && mainWindow.webContents;
  arg.length && wc.findInPage(arg) || wc.stopFindInPage('clearSelection');
})
ipcMain.on('starter-pio', function(ev) {
  pio.install()
  .then(result => ev.sender.send('starter-pio', result))
  .catch(e => dialog.showErrorBox('Error', e))
})

app.on('ready', function() {
    var status = new BrowserWindow({width: 400, height: 400, maximizable: false})
    status.setMenu(null);
    const update = val => status.webContents.send('starter-git', val);
    var folders = store.get('folders') || [];
    var opts = {'-G': 0};
    Object.keys(opts).reduce((v, key) => (v.i = v.p.indexOf(key), v.i >= 0 && (opts[key] = v.p[v.i + 1]), v), {p: process.argv});

    Promise.all([
      promisify(which)(gitExe).then(a => 1).catch(a => 0),
      promisify(which)('pio').then(a => 1).catch(a => 0),
      promisify(fs.readFile)(path.join(__dirname, 'views', 'start.html')),
    ])
    .then(p => {
      var statusFile = 'data:text/html;charset=UTF-8,' + encodeURIComponent(p[2].toString());
      status.loadURL(statusFile);
      status.show()
      ipcMain.on('starter-init', ev => {
        ev.sender.send('starter-init', {
            git: p[0],
            pio: p[1],
            folders: folders,
        })
      })
      return (new Promise(function(resolve, reject) {
        ipcMain.on('starter-folder', function(ev, num) {
          resolve(num == 'new' ? '' : folders[num]);
        })
      }))
    })
    .then(folder => promisify(which)(gitExe).then(a => folder))
    .then(function(folder) {
      const check = dir =>
          promisify(fs.access)(dir, fs.constants.W_OK)
          .then(a => dir)
          .catch(e => (dialog.showErrorBox('Access','The application hasn\'t access to this folder,\nselect a folder from my Documents or Desktop'),chain()))
      const chain = () => getFolder().then(check);
      return folder && check(folder) || opts['-G'] || chain();
    })
    .then(dir => git.root(dir)
        .catch(e => {
          console.log('no repository found in this folder');
          showNotify('Wait while Marlin Firmware repo cloning');
          dir = path.join(dir, 'Marlin')
          return git.clone(dir, update)
            .then(git.root)
            .then(a => showNotify('Well done!'))
            .catch(e => git.root(dir));
        })
    )
    .then(folder => {
      var i = folders.indexOf(folder);
      i >= 0 && folders.splice(i, 1);
      folders.unshift(folder);
      store.set('folders', folders);
      return folder;
    })
    .then(()=>server.main(1))
    .then(function(url){
      mainWindow = new BrowserWindow({
          height: 768,
          width: 1280,
          icon: path.join(__dirname, 'build/icons/icon_64x64.png'),
          webPreferences: {
            experimentalFeatures: true,
          },
      });
      mainWindow.loadURL(url);
      status.close();
      mainWindow.webContents.on('found-in-page', function (event, result) {
        var count = 0;
        if (result && result.finalUpdate)
          count = result.matches;
        event.sender.send('search-found', count);
      });
      mainWindow.on('close', function() {
      console.log('quit()')
        app.quit();
      })
    })
    .catch(e => {
      console.error(e.message);
      if (e.message == 'not found: git')
        dialog.showErrorBox('Dependecies','The application needs a GIT tool to be installed!\nhttps://git-scm.com/downloads')
      else
        dialog.showErrorBox('Error', e.message);
      app.quit();
    })
});

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});
