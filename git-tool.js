var git = require('simple-git')();

var gitRoot=()=>
new Promise((done,fail)=>git.revparse(['--show-toplevel'],(e,a)=>e?fail(e):done(a.replace(/\r|\n/,''))))
.then(root=>(console.log('[gitRoot]',root),root))
.catch(mst=>console.log('no root'))

var gitTag=()=>
new Promise((done,fail)=>git.raw(['describe','--tags'],(e,a)=>e?fail(e):done(a.replace(/\r|\n/,''))))
.then(root=>(console.log('[gitTag]',root),root))
.catch(mst=>console.log('no tag'))

var gitTags2=()=>
new Promise((done,fail)=>git.tags([],(e,a)=>e?fail(e):done(a)))
.then(root=>(console.log('[gitTags]',root.all.toString()),root))
var getTag=msg=>{
  var m=msg.match(/\(tag:\s(.*)\)/)
  return m&&m[1];
}
var simplyTag=o=>o.all.map(i=>({date:i.date,tag:getTag(i.message)})).filter(i=>i.tag) //m=?m[1]:
var gitTags=()=>
new Promise((done,fail)=>git.log(['--tags','--simplify-by-decoration'],(e,a)=>e?fail(e):done(a))) //,'--pretty="format:%ci %d"'
.then(simplyTag)
.then(root=>(console.log('[gitTags]',root),root))
.catch(mst=>console.log('no tags'))

var gitShow=(branch,file)=>
new Promise((done,fail)=>git.show([branch+':'+file],(e,a)=>e?fail(e):done(a)));



var gitroot=gitRoot();

exports.Root=gitRoot;
exports.Tag=gitTag;
exports.Tags=gitTags;
exports.Show=gitShow;
exports.git=git;
exports.root=gitroot;
