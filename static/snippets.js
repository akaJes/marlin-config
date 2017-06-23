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
