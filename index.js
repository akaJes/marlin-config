'use strict';
const {app, BrowserWindow, Menu, dialog} = require('electron');
console.log('Node',process.version);

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
      return git.clone(path.join(folder,'Marlin'));
    })
    .catch(function(e){
      if (e&&e.type=="fatal")
        throw e;
      return git.root(path.join(folder,'Marlin'));
    })
    .then(()=>server.main(1))
    .then(function(url){
      mainWindow = new BrowserWindow({
          height: 600,
          width: 800
      });
      mainWindow.loadURL(url);
    return;
      dialog.showMessageBox({
        type:"info",
        title:"Git repository",
        message:folder
      })
    })
    .catch(function(e){
      console.error(e.message)
      app.quit();
    })
});