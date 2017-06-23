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
