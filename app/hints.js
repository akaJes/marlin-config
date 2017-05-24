var fs = require('fs');
var promisify = require('./helpers').promisify;
var marked = require('marked');
var hljs=require('highlight.js');
var path= require('path');
var http = require('https');

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
exports.marked=marked;

var map=type=>t=>t.map((i,n)=>(i.index=n,i)).filter(i=>i.type==type)
var define2index=tokens=>map('code')(tokens).reduce(function(p,ob){
  var match,reg=/#define\s+(\w+)/g;
  while((match=reg.exec(ob.text)) !=null && match.index != reg.lastIndex)
    p[match[1]]=ob.index;
  return p;
},{})

function extendTokens(tokens){
  var _alert={
        $$0:{info:'info',error:'danger',warning:'warning'},
        $$1:{info:'info',error:'remove',warning:'exclamation'},
        regex:/\{\% alert (.*) \%\}((.|\n)*)\{\% endalert \%\}/,
        template:`<div class="container-fluid"> <div class="row alert alert-$$0 custom-alert">
<div class="col-lg-1 col-md-2 visible-lg-block visible-md-block">
<i class="glyphicon glyphicon-$$1-sign" aria-hidden="true" style="font-size:250%;"></i></div>
<div class="col-lg-11 col-md-10">$$2</div> </div> </div>`
  };
  var _panel={
      regex:/\{\% panel (.*) \%\}((.|\n)*)\{\% endpanel \%\}/,
      template:`<div class="card card-info"><div class="card-header">$$1</div><div class="card-block">$$2</div></div>`
  }
  var _custom={
      regex:/\{\:(.*)\}/,
  }
  return tokens.map(t=>{
    if (t.text){
      var m;
      if(m=t.text.match(_alert.regex))
        t.text=_alert.template.replace('$$0',_alert.$$0[m[1]]).replace('$$1',_alert.$$1[m[1]]).replace('$$2',m[2])
      if(m=t.text.match(_panel.regex))
        t.text=_panel.template.replace('$$1',m[1]).replace('$$2',m[2])
      if(m=t.text.match(_custom.regex))
        t.text=t.text.replace(m[0],'')
    }
    return t;
  })
}

var tokens,d2i,headings;

exports.d2i=(name)=>d2i[name];

exports.init=()=>{
  var docFile=path.join(__dirname,'..','views','configuration.md');
  return promisify(fs.readFile)(docFile,'utf8')
  .then(md=>{
    tokens=marked.lexer(md);
    d2i=define2index(tokens);
    headings=map('heading')(tokens).map(i=>i.index);
  })
}
exports.hint=function(name){
  var find=d2i[name]
  var banner='<link rel="stylesheet" title="Default" href="libs/highlight.js/styles/default.css">';
  var banner2='<script src="head.min.js"></script><script>head.load("sheetrock.min.js");</script>';
  var add_banner='';
  if (find){
    var ob=headings.reduce((ob,v)=>{
      if (v>find && ob.max==undefined) ob.max=v;
      if (v<find) ob.min=v;
      return ob;
    },{})
    var cut=tokens.slice(ob.min,ob.max);
    cut=extendTokens(cut);
    if(cut.filter(i=>/sheetrock\.min/.test(i.text||'')).length)
      add_banner=banner2;
    cut.links={};
    return banner+add_banner+marked.parser(cut);
  }
}
exports.listG=()=>0
exports.getG=id=>0