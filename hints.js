var fs = require('fs');
var marked = require('marked');
var hljs=require('highlight.js');
var path= require('path');
var docFile=path.resolve(__dirname,"views/configuration.md")

var http = require('https');
var url="https://github.com/MarlinFirmware/MarlinDocumentation/raw/master/_configuration/configuration.md";

var md=fs.readFileSync(docFile,'utf8');

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

var map=type=>t=>t.map((i,n)=>(i.index=n,i)).filter(i=>i.type==type)
var define2index=map('code')(tokens).reduce(function(p,ob){
  var match,reg=/#define\s+(\w+)/g;
  while((match=reg.exec(ob.text)) !=null && match.index != reg.lastIndex)
    p[match[1]]=ob.index;
  return p;
},{})

var headings=map('heading')(tokens).map(i=>i.index);
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
      template:`<div class="panel panel-info"><div class="panel-heading">$$1</div><div class="panel-body">$$2</div></div>`
  }
  var _custom={
      regex:/\{\:(.*)\}/,
      template:`<div class="panel panel-info"><div class="panel-heading">$$1</div><div class="panel-body">$$2</div></div>`
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
exports.d2i=define2index;
exports.hint=function(name){
  var find=define2index[name]
  var banner='<link rel="stylesheet" title="Default" href="styles/default.css">';
  if (find){
    var ob=headings.reduce((ob,v)=>{
      if (v>find && ob.max==undefined) ob.max=v;
      if (v<find) ob.min=v;
      return ob;
    },{})
    var cut=tokens.slice(ob.min,ob.max);
    cut=extendTokens(cut);
    cut.links={};
    return marked.parser(cut);
  }
}
exports.url=url;
function load(){
  var file = fs.createWriteStream();
  var request = http.get(url, function(response) {
    if (response.statusCode==302)
      http.get(response.headers['location'], function(response) {
        response.pipe(file);
      })
    else
      response.pipe(file);
  });
}
