  function buildBack(ob){
    return ' '.repeat(ob.startSp||0)
      + (ob.disabled&&'//'||'')
      + ' '.repeat(ob.disableSp||0)
      + '#define'
      + ' '.repeat(ob.nameSp||1)
      + ob.name
      + (ob.value&&( ' '.repeat(ob.valueSp||1) +ob.value )||'');
  }
  function commentBack(val,ob){
    return ob.commentAt?val+' '.repeat(Math.max(ob.commentAt-val.length,1))+ob.comment:val;
  }
function build(base){
  return commentBack(buildBack(base),base);
}
module.exports.build=build;
module.exports.h2json=function(h){
  return new Promise(function(r){
    var lines=h.split(/\r\n?|\n/);
    var section,condition=[],select;
    var all=lines.map(function(val,i){
      var match;
      if (match=val.match(/^(\s|\/\/)*@section\s+(\w+)/))
        section=match[2]
      if (match=val.match(/^(\s)*#if\s+(.*)/))
        condition.push(match[2])
      if (match=val.match(/^(\s)*#elif\s+(.*)/))
        with(condition){ pop(); push(match[2]) }
      if (match=val.match(/^(\s)*#endif/))
        condition.pop()
      if (match=val.match(/\:(\{.*\}|\[.*\])/))
        select=match[1];
      if (select&&val=='')
        select=undefined;

      if (/^(\s|\/\/)*#define/.test(val)){
        var base={ id:i, no:i+1, line:val, section:section,condition:condition.slice(),select:select };
        var strip=val;
        //uncomment
        if (match=val.match(/(.*#define.+?)(\/\/.*)/)){
          strip=match[1];
          base.comment=match[2];
          base.commentAt=match[1].length; //TODO: check for 1 space
        }
        strip=strip.trimRight();
        //startAt,disabled,disableAt,nameAt,name,value,valueAt
        var exp=/(\s*)(\/\/(\s*))?#define(\s+)(\w+)((\s+).*)?/;
        match=strip.match(exp);
        if(match[1].length>0)
          base.startSp=match[1].length;
        if (base.disabled=!!match[2])
          if(match[3].length>0)
            base.disableSp=match[3].length;
        if(match[4].length>1)
          base.nameSp=match[4].length;
        base.name=match[5];
        if(match[6]){
          base.value=match[6].trim();
          if(match[7].length>1)
            base.valueSp=match[7].length;
        }
        return base;
        base.back=build(base);
      }
    }).filter(a=>a)
    r(all);
  })
}
module.exports.compare=function(a,b){
  return new Promise(function(r){
    r([a.length,b.length])
  })
}
