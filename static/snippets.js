function bindSpinner(base){
  base.find('.spinner .btn').on('click', function() {
    var inp=$(this).parent().siblings('input')
    inp.val(parseFloat(inp.val())+($(this).hasClass('fa-caret-up')?1:-1)).change()
  });
}
function bindClipboard(base){
  base.find('.fa-clipboard').on('click', function() {
    var range = document.createRange();
    range.selectNodeContents($(this).parent().siblings('p')[0]);
    var sel=getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('copy');
    sel.removeAllRanges();
  });
}
function readValues(inps){
  var vals={};
    inps.each(function(i,inp){
      vals[$(inp).attr('name')]=parseFloat($(this).val());
    })
  return vals;
}
function setCanvasSize(canvas,width,height,scale){
    Object.assign(canvas,{width:width*scale,height:height*scale});
    var ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(scale,scale);
    ctx.imageSmoothingEnabled = false;
}
function drawBootscreen(canvas,screen,size){
    setCanvasSize(canvas,screen.width,screen.height,size);
    function reader(screen){
      var bit=0x80>>(screen.pos%8);
      var pixel=!!(screen.data[parseInt(screen.pos/8)]&bit);
      screen.pos++;
      return pixel;
    }
    var ctx = canvas.getContext("2d");
    for (var y=0;screen.height>y;y++){
      screen.pos=y*Math.ceil(screen.width/8)*8;
      for (var x=0;screen.width>x;x++)
        if (reader(screen)){
          ctx.beginPath();
          ctx.rect(x,y,1,1)
          ctx.fillStyle="black";
          ctx.fill();
        }
    }
}
function createBootscreen(canvas,width,height){
    var inrow=Math.ceil(width/8);
    var buffer=new ArrayBuffer(inrow*height);
    var ar8=new Uint8Array(buffer);
    function writer(row,x,data){
      if (data)
        ar8[row+Math.floor(x/8)]|=0x80>>(x%8);
    }
    var ctx = canvas.getContext("2d");
    var data = ctx.getImageData(0, 0, width, height).data;
    var pixel = 0;
    for (var y=0;height>y;y++){
      for (var x=0;width>x;x++,pixel+=4)
        writer(y*Math.floor(width/8),x,data[pixel]==0);
    }
    var pos=0,lines='';
    for (var i=0;i<ar8.length;i++)
      lines+='0x'+('0'+ar8[pos++].toString(16)).slice(-2)+','+(pos%8?' ':'\n');
    return lines;
}
var resized; //global
function imgReader(file,img,canv,inps){
  var scale=5;
  var canvas=canv[0];
  function setAspect(){
    var width=inps.eq(0).val(),height=inps.eq(1).val();
    img.cropper('setAspectRatio', width/height);
  }
  setCanvasSize(canvas,inps.eq(0).val(),inps.eq(1).val(),scale);
  inps.on('change',function(){
    var width=parseInt(inps.eq(0).val()),height=parseInt(inps.eq(1).val());
    if (canvas.width/scale != width || canvas.height/scale != height ){
      setCanvasSize(canvas,width,height,scale);
      setAspect();
    }else
      img.trigger('crop');
  })
  file.on('change', function (evt) {
    var tgt = evt.target || window.event.srcElement,
        files = tgt.files;
    // FileReader support
    if (FileReader && files && files.length) {
        var fr = new FileReader();
        fr.onload = function () {
            setCanvasSize(canvas,inps.eq(0).val(),inps.eq(1).val(),scale);
            setAspect();
            img.attr('src',fr.result);
            img.cropper('replace', fr.result);
        }
        fr.readAsDataURL(files[0]);
    }
  })
  var cropDefs={
        movable: false,
        zoomable: false,
        rotatable: false,
        scalable: false,
        aspectRatio: 1,
        minCropBoxWidth:10,
        maxCropBoxWidth:10,
        viewMode:1,
      };
  img.cropper(cropDefs);
  img.on('crop',function(){
    var width=inps.eq(0).val(),height=inps.eq(1).val();
    var sel=img.cropper('getData');
    resized=cropImage(img,sel.x,sel.y,sel.width,sel.height,width,height);
    toBW(resized,parseInt(inps.eq(3).val()),inps.eq(4).prop('checked'));
    var destCtx = canvas.getContext('2d');
    destCtx.drawImage(resized, 0, 0);
  })
}
function cropImage(img,x,y,w,h,fw,fh){
  var cv=$('<canvas>')[0];
  cv.width=w;
  cv.height=h;
  var ctx=cv.getContext('2d');
  var aw=w/fw,ah=h/fh,a=Math.min(aw,ah);
  ctx.drawImage(img[0],x,y,w,h,0,0,Math.floor(w/a),Math.floor(h/a));
//  ctx.drawImage(img[0],x,y,w,h,0,0,fw,fh);
  return cv;
}
function toBW(canvas,brightness,inverse){
  var ctx = canvas.getContext("2d");
  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var data = imageData.data;
    for (var i = 0; i < data.length; i += 4) {
      //var avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      var lum = data[i] * 0.3 + data[i+1] * 0.59 + data[i+2] * 0.11;
      if (inverse)
        avg = (lum < brightness) ? 0 : 255;
      else
        avg = (lum < brightness) ? 255 : 0;
      data[i]     = avg; // red
      data[i + 1] = avg; // green
      data[i + 2] = avg; // blue
    }
    ctx.putImageData(imageData, 0, 0);
}
