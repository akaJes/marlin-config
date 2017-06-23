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
function drawBootscreen(canvas,screen,size){
    Object.assign(canvas,{width:screen.width*size,height:screen.height*size});

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
          ctx.rect(x*size,y*size,size,size)
          ctx.fillStyle="black";
          ctx.fill();
        }
    }
}
function imgReader(file,img,canv){
  var destCtx = canv[0].getContext('2d');
  Object.assign(canv[0],{width:5*128,height:5*64});
  destCtx.scale(5, 5);
  destCtx.imageSmoothingEnabled = false;
  file.on('change', function (evt) {
    var tgt = evt.target || window.event.srcElement,
        files = tgt.files;
    // FileReader support
    if (FileReader && files && files.length) {
        var fr = new FileReader();
        fr.onload = function () {
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
        aspectRatio: 2,
        minCropBoxWidth:10,
        maxCropBoxWidth:10,
        viewMode:1,
      };
  img.cropper(cropDefs);
  img.on('aspect',function(ev,aspect){
    cropDefs.aspectRatio = aspect;
    img.cropper('destroy').cropper(cropDefs);
  });
  img.on('crop',function(){
    var sel=img.cropper('getData');
    var canvas=cropImage(img,sel.x,sel.y,sel.width,sel.height,128,64);
    toBW(canvas);
    var ctx = canvas.getContext("2d");
    var destCtx = canv[0].getContext('2d');
    destCtx.drawImage(canvas, 0, 0);
  })
}
function cropImage(img,x,y,w,h,fw,fh){
  var cv=$('<canvas>')[0];
  cv.width=w;
  cv.height=h;
  var ctx=cv.getContext('2d');
  var aw=w/fw,ah=h/fh,a=Math.min(aw,ah);
  ctx.drawImage(img[0],x,y,w,h,0,0,Math.floor(w/a),Math.floor(h/a));
  return cv;
}
function toBW(canvas){
  var ctx = canvas.getContext("2d");
  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var data = imageData.data;
    for (var i = 0; i < data.length; i += 4) {
      var avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i]     = avg; // red
      data[i + 1] = avg; // green
      data[i + 2] = avg; // blue
    }
    ctx.putImageData(imageData, 0, 0);
}
