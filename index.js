'use strict';
const {app, BrowserWindow, Menu, dialog} = require('electron');
console.log('Node',process.version);
const notifier = require('node-notifier');

var which=require('which');
var path=require('path');
var promisify = require('./app/helpers').promisify;
var git = require('./app/git-tool');
var server = require('./app/server');

var mainWindow = null;
var getFolder=()=>new Promise((done,fail)=>
    dialog.showOpenDialog({
      title:'select folder with Marlin Firmware or empty folder to clone it',
      properties:['openDirectory'],
    },function(folders){
      console.log();
      if (!folders)
        return fail({type:'fatal',message:'no folder selected'});
      done(folders[0])
    })
  )
app.on('window-all-closed', () => {
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
app.on('ready', function() {
    var folder;
    promisify(which)('git')
    .catch(function(){
      dialog.showErrorBox('Dependecies','Application needs GIT to be installed!')
      throw {type:'fatal',message:'no Git installed'};
    })
    .then(function(){
      var is={'-G':0}
      .filter((v,key,o,p,i)=>(p=process.argv,i=p.indexOf(key),!v&&i>=0&&i+1<p.length&&(o[key]=p[i+1]),i>=0));
      if (!is['-G'])
        return getFolder();
      return is['-G'];
    })
    .then(f=>folder=f)
    .then(git.root)
    .catch(function(e){
      if (e&&e.type=="fatal")
        throw e;
      console.log('no repository found in this folder');
      showNotify('Wait while Marlin Firmware repo cloning');
      return git.clone(path.join(folder,'Marlin')).then(git.root).then(a=>(showNotify('Well done!'),a));
    })
    .catch(function(e){
      if (e&&e.type=="fatal")
        throw e;
      return git.root(path.join(folder,'Marlin'));
    })
    .then(()=>server.main(1))
    .then(function(url){
      mainWindow = new BrowserWindow({
          height: 768,
          width: 1280,
          icon: path.join(__dirname, 'build/icons/icon_64x64.png')
      });
      mainWindow.loadURL(url);
    })
    .catch(function(e){
      console.error(e.message)
      app.quit();
    })
});