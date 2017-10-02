'use strict';
const {app, BrowserWindow, Menu, dialog} = require('electron');
//require('electron-debug')({showDevTools: true, enabled: true}); //runtime debug
console.log('Node',process.version);
const notifier = require('node-notifier');

var which=require('which');
var path=require('path');
var fs = require('fs');
var promisify = require('./app/helpers').promisify;
var git = require('./app/git-tool');
var server = require('./app/server');

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
    promisify(which)('git')
    .then(function(){
      var is={'-G':0}
      .filter((v,key,o,p,i)=>(p=process.argv,i=p.indexOf(key),!v&&i>=0&&i+1<p.length&&(o[key]=p[i+1]),i>=0));
      var chain = () => getFolder().then(dir =>
          promisify(fs.access)(dir, fs.constants.W_OK)
          .then(a => dir)
          .catch(e => (dialog.showErrorBox('Access','The application hasn\'t access to this folder,\nselect a folder from my Documents or Desktop'),chain()))
        );
      return is['-G'] || chain();
    })
    .then(dir => git.root(dir)
        .catch(e => {
          console.log('no repository found in this folder');
          showNotify('Wait while Marlin Firmware repo cloning');
          dir = path.join(dir, 'Marlin')
          return git.clone(dir)
            .then(git.root)
            .then(a => showNotify('Well done!'))
            .catch(e => git.root(dir));
        })
    )
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