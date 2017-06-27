$(function(){
  var connection = new RTCMultiConnection();
  connection.socketURL = '/';
  connection.socketURL = 'https://rtcmulticonnection.herokuapp.com:443/';
  connection.socketMessageEvent = 'marlin-conf-cam';
  connection.session = {
    audio: true,
    video: true,
    oneway: true,
  };
  connection.sdpConstraints.mandatory = {
    OfferToReceiveAudio: !false,
    OfferToReceiveVideo: !false
  };
  connection.onstream = function(event) {
    console.log(event.mediaElement.src);
    $('video')[0].src = event.mediaElement.src;
  };
  connection.onstreamended = function(event) {
    connection.close()
    join();
  };
  function join(){
    connection.checkPresence('uofgi4qqdvd', function(isRoomEists, roomid) {
      if(isRoomEists) {
        connection.join(roomid);
      }
      else {
        setTimeout(join,3000);
      }
    });
  }
  join();
})
