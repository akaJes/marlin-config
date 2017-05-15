var git = require('simple-git');
var exec  = require('child_process').exec;
var root;


var gitRoot=(root)=>
new Promise((done,fail)=>git(root).revparse(['--show-toplevel'],(e,a)=>e?fail(e):done(a.replace(/\r|\n/,''))))
.then(root=>(console.log('[gitRoot]',root),root))
.catch(mst=>{ console.log('no root'); throw mst})

var gitroot=gitRoot();

var gitTag=()=>
new Promise((done,fail)=>git(root).raw(['describe','--tags'],(e,a)=>e?fail(e):done(a.replace(/\r|\n/,''))))
.then(root=>(console.log('[gitTag]',root),root))
.catch(mst=>console.log('no tag'))

var gitTags2=()=>
new Promise((done,fail)=>git(root).tags([],(e,a)=>e?fail(e):done(a)))
.then(root=>(console.log('[gitTags]',root.all.toString()),root))
var getTag=msg=>{
  var m=msg.match(/\(tag:\s(.*)\)/)
  return m&&m[1];
}
var simplyTag=o=>o.all.map(i=>({date:i.date,tag:getTag(i.message)})).filter(i=>i.tag) //m=?m[1]:
var gitTags=()=>
new Promise((done,fail)=>git(root).log(['--tags','--simplify-by-decoration'],(e,a)=>e?fail(e):done(a))) //,'--pretty="format:%ci %d"'
.then(simplyTag)
.then(root=>(console.log('[gitTags]',root),root))
.catch(mst=>console.log('no tags'))

var gitShow=(branch,file)=>
new Promise((done,fail)=>git(root).show([branch+':'+file],(e,a)=>e?fail(e):done(a)));

var gitCheckout=(branch)=>
new Promise((done,fail)=>git(root).checkout(branch,(e,a)=>e?fail(e):done(a)));


exports.Checkout=gitCheckout;
exports.Root=gitRoot;
exports.Tag=gitTag;
exports.Tags=gitTags;
exports.Show=gitShow;
exports.git=git;
exports.root=a=>{
  if (a){
    gitroot=gitRoot(a);
    return gitroot.then(_root=>root=_root);
  }
  return gitroot;
}

exports.clone=name=>new Promise((done,fail)=>{
  var cmd = exec('git clone https://github.com/MarlinFirmware/Marlin.git '+(name||''));
  var timer = setInterval(a=>process.stdout.write("."), 500)
  cmd.stdout.on('data', (data) => {
    console.log(data.toString());
  });
  cmd.stderr.on('data', (data) => {
    console.log(data.toString());
  });
  cmd.on('close', (code) => {
    clearInterval(timer);
    console.log();
    if (code == 0)
      done();
    else
      fail();
  });
})