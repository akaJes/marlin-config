$(function(){
//  var sstream = ss.createStream();
  var socket = io.connect({path:'/web-view'});
  ss(socket).on('view', function(stream){
    console.log('view')
    $('video')[0].srcObject = stream;
  });

  function gotStream(stream) {
    ss(socket).emit('stream', sstream);
    ss.createBlobReadStream(stream).pipe(sstream);
    $('video')[0].srcObject = stream;
  }
  function handleError(error) {
    console.log('Error: ', error);
  }
})
