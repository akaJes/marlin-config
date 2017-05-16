//modules
var fs = require('fs');
var path = require('path');
var mc = require('./mc');
var mctool = require('./mc-tool');
var walk = require('./walk').walk;
var pjson = require('./package.json');
var git = require('./git-tool');
var server = require('./server');
var readline = require('readline');
var hints = require('./hints');

var doJson=(root)=>
Promise.resolve(root)
.then(path=>path+'/Marlin/example_configurations')
.then(walk)
.then(f=>f.filter(a=>/Configuration(_adv)?\.h/.test(a)))
.then(f=>Promise.all(f.map(mctool.makeJson(root))))
.then(a=>(console.log('done ALL json'),root))

var doH=(root)=>
Promise.resolve(root)
.then(path=>path+'/Marlin/example_configurations')
.then(walk)
.then(f=>f.filter(a=>/Configuration(_adv)?\.json/.test(a)))
.then(f=>Promise.all(f.map(mctool.makeH(root))))
.then(a=>(console.log('done ALL h'),root))

var unlink=f=>
new Promise((done,fail)=>fs.unlink(f,(e,a)=>e?fail(e):done(a)));

var rmJson=(root)=>
Promise.resolve(root)
.then(path=>path+'/Marlin/example_configurations')
.then(walk)
.then(f=>f.filter(a=>/Configuration(_adv)?\.(json|not)/.test(a)))
.then(f=>Promise.all(f.map(unlink)))
.then(a=>console.log('done rm ALL .json / .not'))

function main(){
  var is={tree:1,json:1,h:1,git:0,rm:1,help:1,txt:1,conf:1,clone:1,hints:1}
  .filter((v,key,o,p,i)=>(p=process.argv,i=p.indexOf(key),!v&&i>=0&&i+1<p.length&&(o[key]=p[i+1]),i>=0));
//    var tag=git.Tag();
//    var tags=git.Tags();
  if ( is.help )
    help()
  else
  if ( is.git ) {
    ['Marlin/Configuration_adv','Marlin/Configuration'].forEach(f=>{
      var base=Promise.all([git.root(),git.Show(is.git,f)]);
      if ( is.json )
        base
        .then(a=>mctool.makeJson(a[0],a[1])(path.join(a[0],f+'.h')))
      else
      if ( is.h )
        base
        .then(a=>mctool.makeH(a[0],a[1])(path.join(a[0],f+'.json')))
      else
      if ( is.txt )
        base
        .then(a=>mctool.makeTxt(a[0],a[1],{git:is.git,name:pjson.name,version:pjson.version})(path.join(a[0],f+'.h')))
    })
  }else
  if ( is.tree ){
      git.root()
      .then( root=> is.json ? doJson(root) : root )
      .then( root=> is.h ? doH(root) : root )
      .then( is.rm ? rmJson : 0);
  }else
  if ( is.conf ){
    server.main()
  }else
  if ( is.hints ){
    hints.load()
  }else
  if ( is.clone ){
    git.root().then(root=>{
      console.log('there is git');
    }).catch(err=>{
      git.clone().then(a=>console.log('over'));
    })
  }else{
    function getConsole(){
      return readline.createInterface({
          input: process.stdin,
          output: process.stdout
      });
    }
    function startWeb(){
      git.root()
      .then(root=>{
        console.log('type: mct help if you need more information');
          if(root){
          var rl = getConsole();
          rl.question('press Enter to run web browser or ^C to exit', (answer) => {
            rl.close();
            server.main()
          });
        }
      })
    }
    function tryRun(){
      process.chdir('Marlin')
console.log(process.cwd())
      git.root('Marlin').then(a=>{
        server.main();
      });
    }
    git.root()
    .then(startWeb)
    .catch(a=>{
        var rl = getConsole();
        rl.question('press Enter to clone it from web or ^C to exit', (answer) => {
          rl.close();
          git.clone()
          .then(tryRun)
          .catch(tryRun)
        });
    })
  }

}
function help(){
  console.log(`${pjson.name} v ${pjson.version}
usage: mct help|git|tree|conf|clone
You need to run it in Marlin git repository
commands:
    mct
        asks to 'clone' if current folder has no repository then run 'conf'
    mct conf
        open browser for interactive configuration
    mct clone
        clone current Marlin repository to current working directory
    mct git <git-tag> json|h|txt
        json: compare [gitroot]/Marlin/Configuration*.h files
              between git-tag files and files in folder then
              create .json files with your personal setting
        h:    extend [gitroot]/Marlin/Configuration*.h files
              from git-tag with .json files contained your personal setting
        txt:  like json but create txt files contained only changes
              for publication
    mct tree json|h|rm
      Each of these traverse [gitroot]/Marlin/example_configurations directory
        json: compare configurations with main files [gitroot]/Marlin/Configuration*.h
              and generate .json file with its differences for each
              and .not files for #defines which not present in base files
        h:    recreate .h files based on 
              main files [gitroot]/Marlin/Configuration*.h and .json
        rm:   remove .json and .not files
  `);
}
module.exports.main=main;
require.main===module && main();