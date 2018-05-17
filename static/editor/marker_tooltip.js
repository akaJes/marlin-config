define("marker_tooltip",function(require, exports, module) {
"use strict";

var oop = require("ace/lib/oop");
var event = require("ace/lib/event");
var Tooltip = require("ace/tooltip").Tooltip;

function MarkerTooltip (editor) {
    if (editor.markerTooltip)
        return;
    Tooltip.call(this, editor.container);
    editor.markerTooltip = this;
    this.editor = editor;

    this.update = this.update.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseOut = this.onMouseOut.bind(this);
    event.addListener(editor.renderer.scroller, "mousemove", this.onMouseMove);
    event.addListener(editor.renderer.content, "mouseout", this.onMouseOut);
}

oop.inherits(MarkerTooltip, Tooltip);

(function(){
    this.update = function() {
        this.$timer = null;
        var r = this.editor.renderer;
        if (this.lastT - (r.timeStamp || 0) > 1000) {
            r.rect = null;
            r.timeStamp = this.lastT;
            this.maxHeight = window.innerHeight;
            this.maxWidth = window.innerWidth;
        }

        var canvasPos = r.rect || (r.rect = r.scroller.getBoundingClientRect());
        var offset = (this.x + r.scrollLeft - canvasPos.left - r.$padding) / r.characterWidth;
        var row = Math.floor((this.y + r.scrollTop - canvasPos.top) / r.lineHeight);
        var col = Math.round(offset);

        var screenPos = {row: row, column: col, side: offset - col > 0 ? 1 : -1};
        var session = this.editor.session;
        var docPos = session.screenToDocumentPosition(screenPos.row, screenPos.column);

        var marker = (function(m, pos) {
          return Object.keys(m).filter(function(i) {
            return m[i].range && 0 == m[i].range.compare(pos.row, pos.column);
          })
        }(session.$backMarkers, docPos));

        if (marker.length) {
          var tokenText = session.$backMarkers[marker[0]].replace;
          if (tokenText) {
            if (this.tokenText != tokenText) {
              this.setText(tokenText);
              this.width = this.getWidth();
              this.height = this.getHeight();
              this.tokenText = tokenText;
            }
            this.show(null, this.x, this.y);
            return;
          }
        }
        this.hide();
    };

    this.onMouseMove = function(e) {
        this.x = e.clientX;
        this.y = e.clientY;
        if (this.isOpen) {
            this.lastT = e.timeStamp;
            this.setPosition(this.x, this.y);
        }
        if (!this.$timer)
            this.$timer = setTimeout(this.update, 100);
    };

    this.onMouseOut = function(e) {
        if (e && e.currentTarget.contains(e.relatedTarget))
            return;
        this.hide();
        this.editor.session.removeMarker(this.marker);
        this.$timer = clearTimeout(this.$timer);
    };

    this.setPosition = function(x, y) {
        if (x + 10 + this.width > this.maxWidth)
            x = window.innerWidth - this.width - 10;
        if (y > window.innerHeight * 0.75 || y + 20 + this.height > this.maxHeight)
            y = y - this.height - 30;

        Tooltip.prototype.setPosition.call(this, x + 10, y + 20);
    };

    this.destroy = function() {
        this.onMouseOut();
        event.removeListener(this.editor.renderer.scroller, "mousemove", this.onMouseMove);
        event.removeListener(this.editor.renderer.content, "mouseout", this.onMouseOut);
        delete this.editor.mrkerTooltip;
    };

}).call(MarkerTooltip.prototype);
return MarkerTooltip;
//exports.MarkerTooltip = MarkerTooltip;

});
