//modules
var fs = require('fs');
var path = require('path');
var mc = require('./mc');

//common
var inFile=name=>new Promise((done, fail) => fs.readFile( name, 'utf8', (err, data) => err ? fail( err ) : done( data ) ) )
var outFile=name=>text=>new Promise((done,ex)=>fs.writeFile(name,text,err=>err?ex(err):done(text)))
var toJson=a=>JSON.stringify(a,null,2);
var parseJson=a=>JSON.parse(a);
var text2array=text=>text.split(/\r\n?|\n/);
var array2text=(a,text)=>(text='',a.forEach(i=>text+=i+'\n'),text.slice(0,-1));

Object.prototype.filter = function( predicate, obj ) {
    var result = { };
    obj = obj || this
    for (var key in obj) {
        if( obj.hasOwnProperty(key) && predicate( obj[key], key, obj ) ) {
            result[key] = obj[key];
        }
    }
    return result;
};

//workers

var onlyChanged=a=>a.filter(i=>i.changed);

var remap=a=>{
  var objs={};
  a.forEach(i=>(objs[i.name]=objs[i.name]||[]).push(i))
  return objs;
}
var addNumber=a=>{
  var map=remap(a);
  var numbers={};
  return a.map(i=>{
    return map[i.name].length==1?i:(numbers[i.name]=numbers[i.name]||0,i.number=numbers[i.name]++,i)
  })
}

var setConfig=(target,file,root)=>a=>{
  var map=remap(a);
  return target.then(t=>{
    var undef=[];
    var res=t.map(i=>{
      var o=map[i.name];
      if (!o){
        undef.push(i.line);
        return;
      }
      var o=o[Math.min(i.number||0,o.length-1)];
      if (o){
        var changed={};
        if ( changed.disabled = o.disabled != i.disabled )
          o.disabled = i.disabled;
        if ( i.value  != undefined || o.value  != undefined )
          if ( changed.value = (o.value || '').trim() != (i.value || '').trim() )
            o.value = i.value;
        if ( i.comment != undefined || o.comment != undefined )
          if ( changed.comment = ( o.comment || '' ).trim() != ( i.comment || '' ).trim() )
            o.comment = i.comment;
        if ( changed.disabled || changed.value || changed.comment )
          o.changed=changed;
      }
      return o;
    }).filter(i=>i)
    if (undef.length&&file){
        console.log('undefined for:',path.relative(root,file));
        var p=path.parse(file);
        Promise
        .resolve(array2text(undef))
        .then(outFile(path.join(p.dir,p.name+'.not')))
//        .then(a=>console.log('saved'))
    }
    return res;
  })
}
var stripConf=a=>a.map(i=>{
  var obj = { name: i.name };
  if ( i.number != undefined )
    obj.number = i.number;
  ( i.changed || {} ).filter((val,name)=>{
      if ( val )
        obj[name] =  i[name];
  });
  return obj;
});



var remapNum=a=>{
  var objs={};
  a.forEach(i=>(objs[i.name]=objs[i.name]||[])[i.number||0]=i)
  return objs;
}
var loadConfig=a=>target=>{
  return a.then((cfg,map)=>(map=remapNum(cfg),target.map(i=>{
      var o=map[i.name];
      if( o && ( o = o[i.number||0] ) ) {
        i.changed = {};
        ['disabled','value','comment','number']
          .map(f=>i.changed[f] = o[f] != undefined ? ( i[f] = o[f] ) : 0 );
      }
      return i;
    })
  ))
}
var extendFrom=file=>ch=>file.then(text2array).then(l=>(ch.forEach(i=>l[i.id]=mc.build(i)),l))

var unique=a=>a.filter((elem, index, self)=>index == self.indexOf(elem))
var uniqueJson=(a,m)=>(m=a.map(i=>JSON.stringify(i)),a.filter((elem, index, self)=>index == m.indexOf(JSON.stringify(elem))))
var toTxt=ch=>ch.map(i=>mc.build(i))
var banner=cfg=>a=>(a.unshift('// this file genarated by '+cfg.name+' '+cfg.version,'// used revision '+cfg.git+' as base','// below listed only differences'),a)

//exports

module.exports.makeJson=(root,base)=>file=>{
    var p=path.parse(file);
    var conf = inFile(file).then(mc.h2json);
    var h=base?Promise.resolve(base):inFile(path.join(root||'','Marlin',p.name+'.h'));
    return h//(base?Promise.resolve(base):inFile(path.join('./Marlin',p.base)))
    .then(mc.h2json)
    .then(addNumber)
    .then(setConfig(conf.then(addNumber),file,root))
    .then(onlyChanged)
    .then(stripConf)
    .then(uniqueJson)
    .then(toJson)
    .then(outFile(path.join(p.dir,p.name+'.json')))
    .then(a=>console.log('done json: ',path.relative(root,file)))
    .catch(a=>console.log('fail json: ',file,a))
}
var groups=[
      ["DELTA", //?
      "MORGAN_SCARA", //?
      "MAKERARM_SCARA", //?
      "COREXY",
      "COREXZ",
      "COREYZ",
      "COREYX",
      "COREZX",
      "COREZY"],
      ["PROBE_MANUALLY",
      "FIX_MOUNTED_PROBE",
      ["Z_ENDSTOP_SERVO_NR","Z_SERVO_ANGLES"],
      "BLTOUCH",
      "Z_PROBE_ALLEN_KEY", //?
      "SOLENOID_PROBE",
      "Z_PROBE_SLED",
      ],
      ["AUTO_BED_LEVELING_3POINT",
      "AUTO_BED_LEVELING_LINEAR",
      "AUTO_BED_LEVELING_BILINEAR",
      "AUTO_BED_LEVELING_UBL",
      "MESH_BED_LEVELING"],
      ['TODO: //LCDs'],
]
var type=i=>i.value==undefined?'BOOL':'string'
var section0=i=>i.name+' '+type(i)+(i.condition.length&&(' == '+i.condition.join(' AND '))||'')
var section=i=>({name:i.name,type:type(i),condition:i.condition.length&&i.condition||undefined,value:i.value||!i.disabled})

module.exports.getJson=(root,base)=>file=>{
    var p=path.parse(file);
    var conf = inFile(file).then(mc.h2json);
    var h=base?Promise.resolve(base):inFile(path.join(root||'','Marlin',p.name+'.h'));
    return h
    .then(mc.h2json)
    .then(addNumber)
    .then(a=>a.filter(i=>!i.number||i.number !=undefined&&!i.disabled)) //remove commented duplicates
//    .then(a=>({sections:unique(a.map(i=>i.section)).filter(a=>a),names:a}))
    .then(a=>({file:path.parse(file),names:a}))
    .then(a=>(a.sections=unique(a.names.map(i=>i.section)).filter(i=>i),a))
//    .then((a,m)=>(m={},a.sections.map(s=>(m[s]=a.names.filter(i=>i.section==s).map(section))),{groups:groups,sections:m,names:a.names}))
    .then(a=>(a.groups=groups,a))
    .then(a=>(a.list=a.sections.reduce((p,s)=>(p[s]=a.names.filter(i=>i.section==s).map(section0),p),{}),a))
    .then(a=>(a.all=a.sections.reduce((p,s)=>(p[s]=a.names.filter(i=>i.section==s).map(section),p),{}),a))
    .then(a=>(a.names=undefined,a))
//    .then(a=>(a.groups=groups,a.sections={},a.sections.reduce((ob,s)=>(m[s]=a.names.filter(i=>i.section==s).map(section)),a)))
//    .then(toJson)
    .then(a=>(console.log('done json: ',path.relative(root,file)),a))
    .catch(a=>console.log('fail json: ',file,a))
}

module.exports.makeTxt=(root,base,git)=>file=>{
    var p=path.parse(file);
    var conf = inFile(file).then(mc.h2json);
    var h=base?Promise.resolve(base):inFile(path.join(root||'','Marlin',p.name+'.h'));
    return h
    .then(mc.h2json)
    .then(addNumber)
    .then(setConfig(conf.then(addNumber),file,root))
    .then(onlyChanged)
    .then(stripConf)
    .then(toTxt)
    .then(unique)
    .then(banner(git))
    .then(array2text)
    .then(outFile(path.join(p.dir,p.name+'.txt')))
    .then(a=>console.log('done txt: ',path.relative(root,file)))
    .catch(a=>console.log('fail txt: ',file,a))
}


module.exports.makeH=(root,base)=>file=>{
    var p=path.parse(file);
    var h=base?Promise.resolve(base):inFile(path.join(root||'','Marlin',p.name+'.h'));
    return h
    .then(mc.h2json)
    .then(addNumber)
    .then(loadConfig(inFile(file).then(parseJson)))
    .then(onlyChanged)
    .then(extendFrom(h))
    .then(array2text)
    .then(outFile(path.join(p.dir,p.name+'.h')))
    .then(a=>console.log('done h: ',path.relative(root,file)))
    .catch(a=>console.log('fail h: ',file,a))
}
