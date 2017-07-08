$(function(){
  var streamID='uofgi4qqdvd';
  var base=$('.cam-preview');
  $.ajax('/upnp/local')
  .then(function(data){
    var url='https://'+data.ip+':'+data.https+'/cam/';
    base.find('.col-8 a').text(url).attr('href',url);
  });
  base.find('.btn-warning').on('click',function(){
    var url=$(this).siblings('a').attr('href');
    var m=$('#mct-qr-modal');
    m.find('.modal-body img').attr('src','/qr/'+encodeURI(btoa(url)))
    m.modal();
  });
  base.find('.onoffswitch').on('change',voice);
  var connection = new RTCMultiConnection();
  connection.enableLogs=false;
  connection.socketURL = '/';
//  connection.socketURL = 'https://'+location.hostname+':3002/';
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
  connection.onstream = function(event) {
    $('video')[0].src = event.mediaElement.src;
    connected=true;
    voice()
  };
//connection.dontAttachLocalStream = true;
  connection.dontCaptureUserMedia = true;
  var connected=false;
  function voice(){
    var mode=base.find('.onoffswitch input').prop('checked')
    connection.streamEvents.selectFirst().stream[mode?'mute':'unmute']('audio')
  }
  function leave(){
    connection.getAllParticipants().forEach(function(participantId) {
      connection.disconnectWith(participantId);
    });
  }
  connection.onstreamended = function(event) {
    console.log('onstreamended')
    leave();
    connected=false;
    join();
  };
  connection.onclose = function(event) {
    console.log('onclose')
  };
  connection.onleave = function(event) {
    console.log('onleave')
  };
  function join(){
    if (connected)
      return;
    connection.checkPresence(streamID, function(isRoomExists, roomid) {
      if(isRoomExists)
        connection.join(roomid);
    });
  }
  join();
  setInterval(join,3000);
})
