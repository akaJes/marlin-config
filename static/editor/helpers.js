function debounce(f, ms, obj) {
  var timer;
  return function () {
    var self = this, args = arguments;
    timer && clearTimeout(timer);
    timer = setTimeout(function() {
      f && f.apply(obj || self, args);
      timer = null;
    }, ms);
  }
}
function toggleFullScreen() {
  var doc = window.document;
  var docEl = doc.documentElement;

  var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
  var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

  if(!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
    requestFullScreen.call(docEl);
  }
  else {
    cancelFullScreen.call(doc);
  }
}
function isElectron() {
  return navigator.userAgent.toLowerCase().indexOf(' electron/') >= 0;
}