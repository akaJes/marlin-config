//modules
var fs = require('fs');
var path = require('path');
var mc = require('./mc');
var ht = require('./helpers');

//common
var inFile=name=>new Promise((done, fail) => fs.readFile( name, 'utf8', (err, data) => err ? fail( err ) : done( data ) ) )
var outFile=name=>text=>new Promise((done,ex)=>fs.writeFile(name,text,err=>err?ex(err):done(text)))
var toJson=a=>JSON.stringify(a,null,2);
var parseJson=a=>JSON.parse(a);
var text2array=text=>text.split(/\r\n?|\n/);
var array2text=(a,text)=>(text='',a.forEach(i=>text+=i+'\n'),text.slice(0,-1));

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

var killComments=a=>a.map(i=>(i.comment=null,i))
var killDublicated=a=>a.filter(i=>i.number==undefined||!i.disabled).map(i=>(i.number=undefined,i))

var setConfig=(target,file,root)=>a=>{
  var map=remap(a);
  return Promise.resolve(target).then(t=>{
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
        if ( i.comment !== null )
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
var addChanged=target=>origin=>
  target
  .then(remap)
  .then(map=>
    origin.map(i=>{
      if (i.number != undefined && i.disabled ) return; //no need dublicates
      var oo=map[i.name];
      if (oo){
        oo=oo.filter(i=>!i.disabled)
        o=oo[oo.length-1];
        if (o){
          var changed = {};
          if ( o.disabled != i.disabled )
            changed.disabled = o.disabled;
          if ( i.value  != undefined || o.value  != undefined )
            if ( (o.value || '').trim() != (i.value || '').trim() )
              changed.value = o.value;
          if ( changed.disabled !=undefined || changed.value !=undefined )
            i.changed=changed;
        }
      }
      return i;
    }).filter(i=>i)
  )

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

var stripConfA=a=>a.map(i=>{
  var obj = { name: i.name, disabled: i.disabled, value:i.value };
  if ( i.number != undefined )
    obj.number = i.number;
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
var type1=i=>i.value&&(i.select?'select':/\".*\"/.test(i.value)?'string':/false|true/.test(i.value)?'boolean':'numeric')||undefined //"
var section0=i=>i.name+' '+type(i)+(i.condition.length&&(' == '+i.condition.join(' AND '))||'')
var section=i=>({name:i.name,type:type(i),condition:i.condition.length&&i.condition||undefined,value:i.value||!i.disabled})
var section1=(p,i)=>(p[i.name]={changed:i.changed,type:type1(i),condition:i.condition.length&&i.condition||undefined,value:i.value,disabled:i.disabled,line:i.line,select:i.select},p)
var section_txt=(p,i)=>(i.changed&&(p[i.name]={value:i.changed.value||i.value,disabled:i.changed.disabled||i.disabled}),p)

/* PROCESSORS */

module.exports.getJson=(root,base,tag)=>file=>{
    var p=path.parse(file);
    var conf = inFile(file).then(mc.h2json).then(addNumber);
//console.log(base);
    var h=base?Promise.resolve(base):inFile(path.join(root||'','Marlin',p.name+'.h'));
    return h
    .then(mc.h2json)
    .then(addNumber)
    .then(addChanged(conf))
    .then(a=>a.filter(i=>!i.number||i.number !=undefined&&!i.disabled)) //remove commented duplicates
//    .then(a=>a.filter(i=>i.number==undefined||i.changed&&!i.changed.disabled)) //remove commented duplicates
    .then(a=>({file:path.parse(file),names:a,tag:tag}))
    .then(a=>(a.sections=unique(a.names.map(i=>i.section)).filter(i=>i),a))
    .then(a=>((a.sections=a.sections.length?a.sections:['common']),a))
//    .then((a,m)=>(m={},a.sections.map(s=>(m[s]=a.names.filter(i=>i.section==s).map(section))),{groups:groups,sections:m,names:a.names}))
    .then(a=>(a.groups=groups,a))
    .then(a=>(a.defs=a.names.reduce(section1,{}),a))
    .then(a=>(a.list=a.sections.reduce((p,s)=>(p[s]=a.names.filter(i=>(i.section||'common')==s).map(i=>i.name),p),{}),a))
//    .then(a=>(a.all=a.sections.reduce((p,s)=>(p[s]=a.names.filter(i=>i.section==s).map(section),p),{}),a))
//??    .then(a=>(a.txt=a.names.reduce(section_txt,{}),a)) //changed
//    .then(a=>(a.names=undefined,a))
    .then(a=>(console.log('done json: ',path.relative(root,file)),a))
    .catch(a=>console.log('fail json: ',file,a))
}

module.exports.updateH=(root,file,json)=>{
    var h=inFile(file);
    return h
    .then(mc.h2json)
    .then(addNumber)
    .then(loadConfig(Promise.resolve(json)))
    .then(onlyChanged)
    .then(extendFrom(h))
    .then(array2text)
    .then(outFile(file))
    .then(a=>(console.log('updated h: ',path.relative(root,file)),a))
    .catch(a=>{ console.log('fail h: ',file,a); throw a;})
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

module.exports.makeCfg=file=>{
    return inFile(file)
    .then(mc.h2json)
    .then(addNumber)
    .then(killComments)
    .then(killDublicated)
//    .then(stripConfA)
//    .then(uniqueJson)
//    .then(toJson)
//    .then(outFile(path.join(p.dir,p.name+'.json')))
    .then(a=>(console.log('done conf: ',file),a))
    .catch(a=>(console.log('fail conf: ',file,a),a))
}

module.exports.makeHH=(root,name)=>conf=>{
    var p=path.join(root||'','Marlin',name);
    var h=inFile(p);
    return h
    .then(mc.h2json)
    .then(addNumber)
    .then(setConfig(conf))
    .then(onlyChanged)
    .then(stripConf)
    .then(uniqueJson)
//    .then(extendFrom(h))
//    .then(array2text)
//    .then(outFile(path.join(p.dir,p.name+'.h')))
    .then(a=>(console.log('done conf h: ',path.relative(root,p)),a))
    .catch(a=>(console.log('fail conf h: ',file,a),a))
}

module.exports.makeHfile=(root,name)=>conf=>{
    var p=path.join(root||'','Marlin',name);
    var h=inFile(p);
    return h
    .then(mc.h2json)
    .then(addNumber)
    .then(setConfig(conf))
    .then(onlyChanged)
    .then(extendFrom(h))
    .then(array2text)
    .then(outFile(p))
    .then(a=>(console.log('done update h file: ',path.relative(root,p)),a))
    .catch(a=>(console.log('fail update h file: ',file,a),a))
}
