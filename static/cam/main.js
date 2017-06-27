$(function(){
  var selects={
      audioinput: {ui:$('select').eq(0),name:'microphone',num:0},
      videoinput: {ui:$('select').eq(1),name:'camera',num:0},
  };
  navigator.mediaDevices
  .enumerateDevices()
  .then(gotDevices)
  .then(getStream)
  .catch(handleError);

  function gotDevices(deviceInfos) {
    deviceInfos.forEach(function(deviceInfo){
      if (!(deviceInfo.kind in selects ))
        console.log('Found ome other kind of source/device: ', deviceInfo);
      else{
        var select = selects[deviceInfo.kind];
        $('<option>').val(deviceInfo.deviceId)
        .appendTo(select.ui)
        .text(deviceInfo.label || select.name + ' ' + (++select.num));
      }
    })
  }
  $('select').on('change',getStream)
  function getStream() {
    if (window.stream) {
      window.stream.getTracks().forEach(function(track) {
        track.stop();
      });
    }
    var constraints = {
      audio: {
        optional: [{
          sourceId: selects.audioinput.ui.val()
        }]
      },
      video: {
        optional: [{
          sourceId: selects.videoinput.ui.val()
        }]
      }
    };
    navigator.mediaDevices
    .getUserMedia(constraints)
    .then(gotStream)
    .catch(handleError);
  }
  var sstream = ss.createStream();
  var socket = io.connect({path:'/web-cam'});
  function gotStream(stream) {
    window.stream = stream;
    ss(socket).emit('stream', sstream);
    ss.createBlobReadStream(stream).pipe(sstream);
    $('video')[0].srcObject = stream;
  }
  function handleError(error) {
    console.log('Error: ', error);
  }
})
