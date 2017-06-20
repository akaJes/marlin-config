/*
var dom=createUI(window.document.body,function(cmd){
  console.log(cmd);
})

setTimeout(function(){
//  dom.dispatchEvent(new Event('destroy'));
},1000);
*/
function createUI(ui,cb){
  var domElement=document.createElement('DIV')

  var El=document.createElement('DIV')
  El.innerHTML='[^]';
  El.addEventListener( 'click', toggleSize, false );
  Object.assign(El.style,{position:"absolute", cursor:"pointer", right:"20px", top:"10px", background:"white"})
  domElement.appendChild(El);

  var El=document.createElement('DIV')
  El.innerHTML='[X]';
  El.addEventListener( 'click', function() { domElement.dispatchEvent( new Event('destroy') ); }, false );
  Object.assign(El.style,{position:"absolute", cursor:"pointer", right:"0px", top:"10px", background:"white"})
  domElement.appendChild(El);

//  Object.assign(domElement.style,{position:"relative", cursor:"default", width:"300px", height:"250px", margin:"auto"})
  Object.assign(domElement.style,{position:"relative",height:"100%"})
  ui.appendChild(domElement);

  function toggleSize(ev){
    ev.preventDefault();
    if( ui.className.indexOf('maximized')<0)
      ui.className+=" maximized"
    else
      ui.className=ui.className.split(' ').filter(function(name){ return name!='maximized'; }).join(' ')
if(0)
    if (domElement.style.width!="300px"){
      domElement.style.width="300px";
      domElement.style.height="250px";
    }else{
      domElement.style.width="100%";
      domElement.style.height="100%";
    }
    window.dispatchEvent(new Event('resize'));
  }
  var defaults={
    speedXY:3000,
    speedZ:100,
    speedE:100,
    speedPrint:100,
    speedFan:0,
    speedFlow:100,
    E1:false,
  }
  function onCommand(ev){
    var cmd;
    if (ev.detail.type=='scroll'){
      defaults[ev.detail.command]=ev.detail.value;
      if (ev.detail.command =="speedPrint")
        cmd="M220 S"+ev.detail.value;
      else if (ev.detail.command =="speedFan")
        cmd="M106 S"+parseInt(ev.detail.value)*2.5;
      else if (ev.detail.command =="speedFlow")
        cmd="M221 S"+ev.detail.value;
    }else{
      var cmd="G1 ";
      if (ev.detail.command=="Z")
        cmd+="F"+defaults.speedZ;
      else if (ev.detail.command=="E")
        cmd+="F"+defaults.speedE;
      else
        cmd+="F"+defaults.speedXY;
      cmd+=" "+ev.detail.value;
    }
    if(cmd)
      if(cb)
        cb(cmd);
      else
        console.log(cmd,ev.detail);
  }
  domElement.addEventListener('command', onCommand);
  var scene=createScene(domElement);
  addWidgets(scene,defaults)
  domElement.addEventListener('destroy',function(){
    domElement.removeEventListener('command', onCommand);
    ui.removeChild(domElement);
  });
  return domElement;
}
function addWidgets(scene,defaults){
  //XYZ
  var coord3={
    'y':{ s: 'x', r: 0 },
    'x':{ s: 'z', r: -Math.PI/2 },
    'z':{ s: 'x', r: Math.PI/2 },
  };
  for (var coord in coord3){
    var cfg= coord3[coord];
    var g2=twoSidedArrow(coord.toUpperCase(),coord.toUpperCase(),coord=='z'&&[0.1,1,10,100])
    g2.rotation[cfg.s]=cfg.r;
    scene.add(g2);
  }
  // M201 X3000 Y3000 Z100 E10000
  //Speed XY
  scene.add(translate(0,-10,-5)(rotate(0,0,-90)(scroller("XY speed","speedXY",{min:0,max:10000,pos:defaults.speedXY}))))
  // Speed Z
  scene.add(translate(-5,-5,0)(rotate(90,0,0)(scroller("Z speed","speedZ",{min:0,max:1000,pos:defaults.speedZ}))))
  //Extruder
  scene.add(translate(10,10,0)(rotate(-90,0,0)(twoSidedArrow('E0','E',[5,20,50,100]))))
  if (defaults.E1)
    scene.add(translate(15,10,0)(rotate(-90,0,0)(twoSidedArrow('E1','E',[5,20,50,100]))))
  scene.add(translate(5,10,0)(rotate(90,0,0)(scroller("E speed","speedE",{min:0,max:5000,pos:defaults.speedE}))))

  scene.add(translate(5,5,-10)(rotate(0,0,90)(scroller("Print speed","speedPrint",{min:10,max:300,pos:defaults.speedPrint}))))
  scene.add(translate(-10,0,5)(rotate(0,0,0)(scroller("Fan speed","speedFan",{min:0,max:100,pos:defaults.speedFan}))))
  scene.add(translate(-5,10,0)(rotate(90,0,0)(scroller("Flow speed","speedFlow",{min:10,max:300,pos:defaults.speedFlow}))))
}


function createScene(domElement){
  var loader = new THREE.FontLoader();
  var font;
  loader.load( 'libs/three/examples/'+'fonts/helvetiker_regular.typeface.json', function ( _font ) {
    font=_font;
  });
  var renderer = webglAvailable() ? new THREE.WebGLRenderer() : new THREE.CanvasRenderer();

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(75, domElement.clientWidth/domElement.clientHeight, 0.1, 1000);
  camera.up = new THREE.Vector3( 0, 0, 1 );
  scene.add(camera);

  renderer.setSize(domElement.clientWidth, domElement.clientHeight);
  renderer.setClearColor( 0xf0f0f0 )
  domElement.appendChild(renderer.domElement);

  //camera.position.copy(new THREE.Vector3(20,-20, 20))
  camera.position.copy(new THREE.Vector3(19.82,-13.81, 12.02))
  var target= new THREE.Vector3( 0.47938869793357597, 4.449200655533561, -0.4112674297985155 );
  var controls = new THREE.OrbitControls( camera, renderer.domElement );
  camera.lookAt(target);
  controls.target=target
  controls.maxPolarAngle = Math.PI * 0.5;
  controls.minDistance = -7500;
  controls.maxDistance = 7500;

  var lights = [];
  lights[ 0 ] = new THREE.PointLight( 0xffffff, 1, 0 );
  lights[ 1 ] = new THREE.PointLight( 0xffffff, 1, 0 );
  lights[ 2 ] = new THREE.PointLight( 0xffffff, 1, 0 );

  lights[ 0 ].position.set( 0, 200, 0 );
  lights[ 1 ].position.set( 100, 200, 100 );
  lights[ 2 ].position.set( - 100, - 200, - 100 );

  scene.add( lights[ 0 ] );
  scene.add( lights[ 1 ] );
  scene.add( lights[ 2 ] );

  var renderReq,render = function () {
    if (!renderer ) return;
    setTimeout(function(){ renderReq=requestAnimationFrame(render); },1000/30);
    renderer.render(scene, camera);
  };
  // Calling the render function
  render();

  // projection resolver
  var raycaster = new THREE.Raycaster();
  var _plane = new THREE.Plane();
  var _intersection = new THREE.Vector3();
  var _offset = new THREE.Vector3();
  var mouse = new THREE.Vector2();
  var INTERSECTED,popup,sobj;

  function onDocumentMouseMove( event ) {
    event.preventDefault();
    mouse.x = ( event.offsetX / domElement.clientWidth ) * 2 - 1;
    mouse.y = - ( event.offsetY / domElement.clientHeight ) * 2 + 1;
    if(sobj){
      raycaster.setFromCamera( mouse, camera );
      if ( raycaster.ray.intersectPlane( _plane, _intersection ) ) {
        var sw=_intersection.sub( _offset );

        var p0=getWorldPosition(INTERSECTED)
        var p1=getWorldPosition(INTERSECTED,INTERSECTED.position.clone().setComponent(1,5))
        var _pl = new THREE.Plane().setFromNormalAndCoplanarPoint( p0.clone().sub(p1).normalize() , sw );
        var sw2=_pl.projectPoint(p0)
        var pos=getLocalPosition(sobj.parent,sw2);
        if (pos.y>=0 && sobj._length>=pos.y){
          sobj.position.copy( pos );
          sobj._calc&&sobj._calc(pos.y);
          updatePopup(sobj,sobj._val)
        }
      }
      return;
    }
    check();
  }
  renderer.domElement.addEventListener( 'mousemove', onDocumentMouseMove, false );

  function getWorldPosition(obj,pos){
//  scene.updateMatrixWorld(); //TODO: do it only for this object
  return obj.parent.localToWorld(pos||obj.position.clone())
  }
  function getLocalPosition(obj,pos){
    obj.updateMatrixWorld(); //TODO: do it only for this object
    return obj.worldToLocal(pos.clone())
  }
  function getPlaneLookAt(point){
    return point.clone().sub(camera.position).normalize();
  }

  function onDocumentMouseDown( event ) {
    event.preventDefault();
    if (INTERSECTED)
      if (INTERSECTED.parent){
        controls.enabled=false;
        if (INTERSECTED.name=="scroll"){
          sobj=INTERSECTED;
          var oPos=getWorldPosition(INTERSECTED);
          _plane.setFromNormalAndCoplanarPoint( getPlaneLookAt(oPos),oPos );
          raycaster.setFromCamera( mouse, camera );
          if ( raycaster.ray.intersectPlane( _plane, _intersection ) ) {
            _offset.copy( _intersection ).sub( oPos );
          }
        }else{
          if (INTERSECTED.parent._command)
            domElement.dispatchEvent(new CustomEvent('command',{detail:{type:'button',command:INTERSECTED.parent._command,value:INTERSECTED.parent._val}}));
        }
      }
  }
  renderer.domElement.addEventListener( 'mousedown', onDocumentMouseDown, false );

  function onDocumentMouseUp( event ) {
    event.preventDefault();
    controls.enabled=true;
    if (sobj){
      sobj._over&&sobj._over(sobj._val);
      domElement.dispatchEvent(new CustomEvent('command',{detail:{type:'scroll',command:sobj._command,value:sobj._val}}));
    }
    sobj=null;
  }
  renderer.domElement.addEventListener( 'mouseup', onDocumentMouseUp, false );

  function onWindowResize() {
    camera.aspect = domElement.clientWidth/domElement.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( domElement.clientWidth, domElement.clientHeight );
    render();
  }
  window.addEventListener( 'resize', onWindowResize, false );

  domElement.addEventListener('destroy',function(){
    cancelAnimationFrame(renderReq);
    controls.dispose();
    renderer.domElement.removeEventListener( 'mousemove', onDocumentMouseMove, false );
    renderer.domElement.removeEventListener( 'mousedown', onDocumentMouseDown, false );
    renderer.domElement.removeEventListener( 'mouseup', onDocumentMouseUp, false );
    renderer.dispose();
    delete scene;
    window.removeEventListener( 'resize', onWindowResize, false );
  })

  function webglAvailable() {
    try {
      var canvas = document.createElement( 'canvas' );
      return !!( window.WebGLRenderingContext && (
        canvas.getContext( 'webgl' ) ||
        canvas.getContext( 'experimental-webgl' ) )
      );
    } catch ( e ) {
      return false;
    }
  }

/**/

  function txt(text){
    if (!font) return;
    var geometry = new THREE.TextGeometry( text, {
      font: font,
      size: 1.4,
      height: 0.1,
      curveSegments: 2
    });
    //geometry.computeBoundingBox();
    var materials = [
          //new THREE.MeshBasicMaterial( { color: Math.random() * 0xffffff, overdraw: 0.5 } ),
          new THREE.MeshBasicMaterial( { color: 0x000000, overdraw: 0.5 } ),
          new THREE.MeshBasicMaterial( { color: 0x000000, overdraw: 0.5 } ),
        ];
    var mesh = new THREE.Mesh( geometry, materials );
    return mesh;
  }
  function updatePopup(obj,text){
    if(popup)
      scene.remove(popup);
    popup=txt(text);
    var position=getWorldPosition(obj)
    popup.position.copy(position);
    popup.translateOnAxis( getPlaneLookAt(position) ,-4);
    popup.rotation.copy(camera.rotation);
    scene.add(popup)
  }

  function select(){
    if ( INTERSECTED )
      if (INTERSECTED.material.emissive)
        INTERSECTED.material.emissive.setHex( INTERSECTED.currentHex );
    if (INTERSECTED.material.emissive){
      INTERSECTED.currentHex = INTERSECTED.material.emissive.getHex();
      INTERSECTED.material.emissive.setHex( 0xff0000 );
      INTERSECTED.material.opacity=1;
      var obj=INTERSECTED;
      if (INTERSECTED.parent.name.length){
        obj=obj.parent;
      }
      var text=obj.name;
      if (obj.name=="scroll")
        text=obj._val;
      updatePopup(obj,text);
    }
  }
  function unselect(){
    if ( INTERSECTED )
      if (INTERSECTED.material.emissive){
        INTERSECTED.material.emissive.setHex( INTERSECTED.currentHex );
        INTERSECTED.material.opacity=0.6;
      }
      INTERSECTED = null;
      if (popup){
        scene.remove(popup);
        popup=null;
      }
  }
  function check(){
    raycaster.setFromCamera( mouse, camera );
    var intersects = raycaster.intersectObjects( scene.children, true );
    if ( intersects.length > 0 ) {
      if ( INTERSECTED != intersects[ 0 ].object ) {
        unselect();
        INTERSECTED = intersects[ 0 ].object;
        select();
      }
    } else {
      unselect();
    }
  }
  return scene;
}

/* 3D widgets */

  function arrow(len,col){
    var cyl = cylinder(0.6,0.6,len,col);
    var cyl1 = cylinder(0,1.2,2,col);
    cyl1.material=cyl.material;
    cyl.material.opacity=0.6;
    cyl.material.transparent = true;
    cyl.position.y=len/2;
    cyl1.position.y=len+1;
    return group(cyl,cyl1)
  }
  function scroller(title,name,range,len){
    len=len||20;
    range=range||{pos:0,min:0,max:len};
    function _calc(y){
      this._val=(y/len*(range.max-range.min)+range.min).toFixed(2);
      return this._val;
    }
    var pos=(range.pos-range.min)*len/(range.max-range.min);
    return group(
      translate(0,0,0)(material({transparent:true,opacity:.6})(props({name:title})(cylinder(1,1,len)))),
      translate(0,len/2+1,0)(material({transparent:true,opacity:.6})(cylinder(0,1,2))),
      translate(0,-len/2,0)(position({y:pos||0})(props({name:"scroll",_command:name,_title:title,_length:len,_calc:_calc,_val:range.pos})(cylinder(2,2,1))))
    )
  }
  function twoSidedArrow(title,name,vals){
    var grp=['-','+'].map(function(side){
      var grp=(vals||[1,10,100]).map(function(i,len){
        var arr=arrow(3,side=='+'?0xFF0000:0x0000FF);
        arr._title=title;
        arr._command=name;
        arr._val=name+side+i;
        arr.name=title+side+i;
        arr.position.y=4*len;
        return arr;
      })
      var g=group.apply(0,grp)
      g.rotation.x=side=='-'?Math.PI:0;
      return g;
    })
    return group.apply(0,grp)
  }
// OpenScad style helpers
function cylinder(dt,db,l,color,s) {
  var geometry = new THREE.CylinderGeometry( dt, db, l, s||32 );
  var material = new THREE.MeshLambertMaterial( {color: color||0xffff00} );
  return new THREE.Mesh( geometry, material );
}
function translate(x,y,z){
  return function(obj){
    var parent = new THREE.Object3D();
    parent.add(obj);
    parent.position.set(x||0,y||0,z||0)
    return parent;
  }
}
function rotate(x,y,z){
  return function(obj){
    var parent = new THREE.Object3D();
    parent.add(obj);
    parent.rotation.set( x?x/180*Math.PI:0, y?y/180*Math.PI:0, z?z/180*Math.PI:0 );
    return parent;
  }
}
function material(props){
  return function(obj){
    Object.assign(obj.material,props)
    return obj
  }
}
function position(props){
  return function(obj){
    Object.assign(obj.position,props)
    return obj
  }
}
function props(props){
  return function(obj){
    Object.assign(obj,props)
    return obj
  }
}
function group(){
  var group = new THREE.Group();
  var args = Array.prototype.slice.call(arguments);
  args.forEach(function(i){
    group.add( i );
  })
  return group
}


