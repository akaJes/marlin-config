var http = require('https');
var fs = require('fs');
var marked = require('marked');
var hljs=require('highlight.js');

function load(){
var url="https://github.com/MarlinFirmware/MarlinDocumentation/raw/master/_configuration/configuration.md";
var file = fs.createWriteStream("static/configuration.md");
var request = http.get(url, function(response) {
  if (response.statusCode==302)
    http.get(response.headers['location'], function(response) {
      response.pipe(file);
    })
  else
    response.pipe(file);
});
}
//load();
var md=fs.readFileSync("static/configuration.md",'utf8');
marked.setOptions({
  highlight: function (code) {
    return hljs.highlightAuto(code).value;
  }
});
var renderer = new marked.Renderer();
renderer.image = function (href, title, text) {
  return marked.Renderer.prototype.image.call(renderer,'//marlinfw.org'+href,title,text);
}
renderer.code = function (code, lang) {
  var res= marked.Renderer.prototype.code.call(renderer, code,lang);
  res=res.replace(/"lang-cpp"/,'"lang-cpp hljs"') //maybe jquery?
  return res;
}
marked.setOptions({ renderer: renderer });
var tokens=marked.lexer(md);
var addindex=t=>t.map((i,n)=>(i.index=n,i));
var map=type=>t=>t.map((i,n)=>(i.index=n,i)).filter(i=>i.type==type)
var define2index=map('code')(tokens).reduce(function(p,ob){
  var match,reg=/#define\s+(\w+)/g;
  while((match=reg.exec(ob.text)) !=null && match.index != reg.lastIndex)
    p[match[1]]=ob.index;
  return p;
},{})
var headings=map('heading')(tokens).map(i=>i.index);
var find=define2index['MIXING_VIRTUAL_TOOLS']
var banner='<link rel="stylesheet" title="Default" href="styles/default.css">';

if (find){
  console.log(find);
  var ob=headings.reduce((ob,v)=>{
    if (v>find && ob.max==undefined) ob.max=v;
    if (v<find) ob.min=v;
    return ob;
  },{})
//  console.log(tokens.slice(ob.min,ob.max));
console.log(tokens.links);
  var cut=tokens.slice(ob.min,ob.max);
  cut.links={};
  fs.writeFile("static/conf.html",banner+marked.parser(cut));
//  console.log(banner+marked.parser(cut));
}
//fs.writeFile("map",JSON.stringify(map(tokens),null,2));
fs.writeFile("d",JSON.stringify(define2index,null,2));
fs.writeFile("h",JSON.stringify(headings,null,2));
fs.writeFile("t",JSON.stringify((tokens),null,2));
if(0){
fs.writeFile("static/configuration.html",banner+marked.parser(tokens));
}