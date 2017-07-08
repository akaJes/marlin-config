$(function(){
  var streamID='uofgi4qqdvd';
  var selects={
      audioinput: {ui:$('select').eq(0),name:'microphone',num:0},
      videoinput: {ui:$('select').eq(1),name:'camera',num:0},
  };
  navigator.mediaDevices
  .enumerateDevices()
  .then(gotDevices)
//  .then(getStream)
  .catch(handleError);
  function handleError(error) {
    console.log('Error: ', error);
  }
  function gotDevices(deviceInfos) {
    deviceInfos.forEach(function(deviceInfo){
      if (!(deviceInfo.kind in selects ))
        console.log('Found ome other kind of source/device: ', deviceInfo);
      else {
        var select = selects[deviceInfo.kind];
        $('<option>').val(deviceInfo.deviceId)
        .appendTo(select.ui)
        .text(deviceInfo.label || select.name + ' ' + (++select.num));
      }
    })
  }
  $('select').on('change',getStream)
  function getStream(){
    connection.attachStreams.forEach(function(stream) {
      stream.getVideoTracks().forEach(function(track) {
        stream.removeTrack(track);
        if(track.stop) {
          track.stop();
        }
      });
    });
    connection.attachStreams.forEach(function(stream) {
      stream.getAudioTracks().forEach(function(track) {
        stream.removeTrack(track);
        if(track.stop) {
          track.stop();
        }
      });
    });
    connection.mediaConstraints.video.optional = [{
      sourceId: selects.videoinput.ui.val()
    }];
    connection.mediaConstraints.audio.optional = [{
      sourceId: selects.audioinput.ui.val()
    }];
    connection.captureUserMedia();
  //  connection.renegotiate();
  }

  var connection = new RTCMultiConnection();
  connection.enableLogs=false;
  connection.socketURL = '/';
//  connection.socketURL = 'https://rtcmulticonnection.herokuapp.com:443/';
  connection.socketMessageEvent = 'marlin-conf-cam';
  connection.session = {
    audio: true,
    video: true,
    oneway: true,
  };
  connection.sdpConstraints.mandatory = {
    OfferToReceiveAudio: false,
    OfferToReceiveVideo: false
  };
  function reconnect(){
    connection.connectSocket(function(socket) {
      connection.getAllParticipants().forEach(function(participantId) {
        socket.emit(connection.socketCustomEvent, {
          remoteUserId: participantId,
          reloadVideo: true,
          userid: connection.userid,
          streamid: streamID,
        });
      });
    });
  }
  connection.onstream = function(event) {
    $('video')[0].src = event.mediaElement.src;
    connection.renegotiate();
    reconnect();
  };
  connection.onstreamended = function(event) {
  };
  connection.open(streamID, function() {
  });
})
