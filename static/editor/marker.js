//var animals = require('animals');
//var hash = require('string-hash');

function Marker(session, origin, range){
    this.origin = origin;
    this.session = session;
    this.cursors = [range];
    this.color = getColor(this.origin);
    this.colorRGB = 'rgb('+this.color+')';
    this.colorRGBLight = 'rgba('+this.color+', 0.5)';
    this.animal = 'Anonymous ' 
  //      capitalize(animals.words[hash(this.origin)%animals.words.length]);
};

// (TODO) refactor using jquery
Marker.prototype.update = function(html, markerLayer, session, config){
    var start = config.firstRow, end = config.lastRow;
    var cursors = this.cursors;
    for (var i = 0; i < cursors.length; i++) {
        var rng = {
            start: session.getDocument().indexToPosition(cursors[i].start),
            end: session.getDocument().indexToPosition(cursors[i].end)
        };
        var startScreenPos = session.documentToScreenPosition(rng.start);
        var endScreenPos = session.documentToScreenPosition(rng.end);
        if (startScreenPos.row === endScreenPos.row){//!range.isMultiLine()){
            // only one line
            var height = config.lineHeight;
            var width = config.characterWidth *
                (endScreenPos.column - startScreenPos.column);
            var top = markerLayer.$getTop(startScreenPos.row, config);
            var left = markerLayer.$padding + startScreenPos.column
                * config.characterWidth;
            var range = this.colorRGBLight;
            if(width === 0){
                range = this.colorRGB;
                width = 2;
            }
            var code = '<div class="remoteCaret" style="' +
                'background-color:' +range +';' +
                'height:' + height + 'px;' +
                'top:' + top + 'px;' +
                'left:' + left + 'px;' +
                'width:' + width + 'px">';
            code += '<div class="squareCaret" style="background:' +
                this.colorRGB + ';">';
            code += '<div class="infoCaret" style="background:' +
                this.colorRGBLight + ';">' + (this.name||this.animal) + '</div></div></div>';
            html.push(code);
        }else{
            // multi-line
            // first line
            var height = config.lineHeight;
            var top = markerLayer.$getTop(startScreenPos.row, config);
            var left = markerLayer.$padding + startScreenPos.column *
                config.characterWidth;
            var code = "<div class='remoteCaret selection' style='" +
                "background-color:" + this.colorRGBLight + ";" +
                "height:" + height + "px;" +
                "top:" + top + "px;" +
                "left:" + left + "px;" +
                "right: 0;'>";
            code += '<div class="squareCaret" style="background:' +
                this.colorRGB + ';">';
            code += '<div class="infoCaret" style="background:' +
                this.colorRGBLight + ';">' + (this.name||this.animal) + '</div></div></div>';
            // last line
            height = config.lineHeight;
            top = markerLayer.$getTop(endScreenPos.row, config);
            left = markerLayer.$padding;
            width = config.characterWidth * endScreenPos.column;
            code += "<div class='remoteCaret' style='" +
                "background-color:" + this.colorRGBLight + ";" +
                "height:" + height + "px;" +
                "top:" + top + "px;" +
                "left:" + left + "px;" +
                "width:" + width + "px;'></div>";
            // middle lines
            if (endScreenPos.row - startScreenPos.row > 1){
                height = config.lineHeight *
                    (endScreenPos.row - startScreenPos.row - 1);
                top = markerLayer.$getTop(startScreenPos.row + 1, config);
                left = markerLayer.$padding;
                code += "<div class='remoteCaret' style='" +
                    "background-color:" + this.colorRGBLight + ";" +
                    "height:" + height + "px;" +
                    "top:" + top + "px;" +
                    "left:" + left + "px;" +
                    "right:0;'></div>";
            }
            html.push(code);
        }
    }
};

Marker.prototype.redraw = function(){
    this.session._signal("changeFrontMarker");
};

Marker.prototype.refresh = function(){
    var self = this;
    if (this.timeout){
        clearTimeout(this.timeout);
    };
    this.timeout = setTimeout(function(){
        self.session.removeMarker(self.id);
        delete self.session.remoteCarets[self.origin];
    },10000);
};

Marker.prototype.addCursor = function(){
    // add to this cursors
    // trigger redraw
    this.redraw()
}



function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function getColor(str){
    var h1 = (new Date()).getTime()%206;
    var h2 = (h1*7)%206;
    var h3 = (h1*11)%206;
    return Math.floor(h1+50)+ ", "+Math.floor(h2+50)+ ", "+Math.floor(h3+50);
}
