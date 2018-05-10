      function createFileUploader(element, tree, editor) {
        function addButton(name,fn){
          $(element).append($('<button>').text(name).on('click',fn));
        }
        addButton('Save',function(e){ editor.saveUrl(); });
        addButton('diff Next',function(e){ editor.execCommand("nextDiff") });
        addButton('diff Prev',function(e){ editor.execCommand("prevDiff") });
        addButton('Beautify selected', function(e) {
          if (!editor.getSelectedText()) return;
          var beautify = ace.require("ace/ext/beautify"); // get reference to extension
          var session = ace.createEditSession('demo', editor.session.getOption('mode'));
//          var sel = editor.session.getSelection();
          var range = editor.selection.getRange();
          range.start.column = 0;
          range.end.column = undefined;
          var val = editor.session.doc.getTextRange(range);
          session.setValue(val);
          beautify.beautify(session);
          var b = session.getValue();
          editor.session.doc.replace(range, b);
          editor._signal("change", {});
        });
      }

      function createTree(element, editor) {
        fsbrowser($('.tree'), loadFile)
        function loadFile(path){
//          if(isTextFile(path))
//            loadEditor(path);
//          else
          if(isImageFile(path))
            loadPreview('/s/editor/file/' + path);
          else
            loadEditor(path);
        };
        var ses = [];
        function loadEditor(path) {
          var s = ses.filter(function(i) { return i.path == path; });
          if (!s.length) {
            var name = path.slice(path.lastIndexOf("/") + 1);
            var tab = $('<li class="nav-item"><a class="nav-link" data-toggle="tab" href="#editorTab" role="tab" aria-controls="profile" aria-selected="false">'
              + '<button class="close closeTab" type="button" >×</button>' + name + '</a></li>');
            $('ul.nav').append(tab);
            var o = {
              tab: tab,
              path: path,
              name: name,
              session: ace.createEditSession('demo', 'ace/mode/' + getLangFromFilename(name)),
            }
            tab.find('a').on('shown.bs.tab', function(ev) {
              editor.setSession(o.session);
            })
            tab.find('button').on('click', function(ev) {
              ev.preventDefault();
              if( $(this).parent().is('[aria-expanded=true]'))
                $('#preview-tab').tab('show')
              $(this).parents('li').remove();
              ses = ses.filter(function(i) { return i.path != path; });
            })
            s.push(o);
            ses.push(o);
            editor.setSession(o.session);
            editor.loadUrl(path);
          }
          s[0].tab.find('a').tab('show')
          $('#preview').hide();
        }
        function loadPreview(path){
          $('#preview-tab').tab('show')
          $('#preview').show().html('<img src="'+path+'" style="max-width:100%; max-height:100%; margin:auto; display:block;" />');
        }
        function isTextFile(path){
          var ext = (/(?:\.([^.]+))?$/.exec(path)[1]||'').toLowerCase();
          return 'cpp,c,h,hpp,ino,ini,md,txt,htm,js,c,spp,css,xml'.split(',').indexOf(ext)>=0;
        }
        function isImageFile(path){
          var ext = (/(?:\.([^.]+))?$/.exec(path)[1]||'').toLowerCase();
          return 'png,jpg,jpeg,webp,apng,pdf,gif,xbm,bmp,ico'.split(',').indexOf(ext)>=0;
        }
        this.refreshPath = function(path){
          if(path.lastIndexOf('/') < 1)
            path = '/';
          else
            path = path.substring(0, path.lastIndexOf('/'));
        };
        return this;
      }
        function getLangFromFilename(filename) {
          var lang = "text";
          var ext = (/(?:\.([^.]+))?$/.exec(filename)[1]||'').toLowerCase();;
          if(typeof ext !== undefined){
            switch(ext){
              case "txt": lang = "text"; break;
              case "htm": lang = "html"; break;
              case "md": lang = "markdown"; break;
              case "js": lang = "javascript"; break;
              case "c":case "h": lang = "c_cpp"; break;
              case "cpp":case "hpp": lang = "c_cpp"; break;
              case "css":
              case "scss":
              case "php":
              case "html":
              case "json":
              case "xml":
                lang = ext;
            }
          }
          return lang;
        }

      function createEditor(element, file, lang, theme, type){
        var editor = ace.edit(element);
new (require("marker_tooltip").MarkerTooltip)(editor); // show previous text over highlighted
        function httpPost(filename, data, type) {
          var formData = new FormData();
          formData.append("data", new Blob([data], { type: type }), filename);
          $.post({url:'/s/editor/upload' + file, data: formData, contentType: false, processData: false})
//          $.post({url: '/s/editor/upload' + file, data: data, contentType: false, processData: false})
          .then(function(data){
            alert('saved!');
          },function(data){
            alert("ERROR["+data.status+"]: "+data.responseText);
          });
        }
        function httpGet(theUrl) {
          $.when($.get('/s/editor/file' + theUrl), $.get('/s/editor/git' + theUrl).catch(function(){ return [' ']}))
          .then(function(data, dataGit){
            editor.setOptions({setBaseText: dataGit[0] })
            editor.setValue(data[0]);
//            editor.clearSelection();
            editor.gotoLine(0);
            editor.getSession()._signal("changeAnnotation", {}); //TODO: bug update
          },function(data){
            editor.setValue("");
            alert("ERROR["+data.status+"]: "+data.responseText);
          });
        }
        if(typeof theme === "undefined") theme = "textmate";

//        ace.config.loadModule('/libs/diff-match-patch/index', function() {
          ace.config.loadModule('diff', function(diff) {
            console.log('diff loaded')
          });
//        });
        ace.config.loadModule('ace/ext/beautify', function(diff) {
          console.log('ace/ext/beautify loaded')
        });
        editor.setTheme("ace/theme/"+theme);
        editor.$blockScrolling = Infinity;
        editor.getSession().setUseSoftTabs(true);
        editor.getSession().setTabSize(2);
        editor.setHighlightActiveLine(true);
        editor.setShowPrintMargin(false);
        editor.commands.addCommand({
            name: 'saveCommand',
            bindKey: {win: 'Ctrl-S',  mac: 'Command-S'},
            exec: function(editor) {
              httpPost(file, editor.getValue()+"", type);
            },
            readOnly: false
        });
        editor.commands.addCommand({
            name: 'undoCommand',
            bindKey: {win: 'Ctrl-Z',  mac: 'Command-Z'},
            exec: function(editor) {
              editor.getSession().getUndoManager().undo(false);
            },
            readOnly: false
        });
        editor.commands.addCommand({
            name: 'redoCommand',
            bindKey: {win: 'Ctrl-Shift-Z',  mac: 'Command-Shift-Z'},
            exec: function(editor) {
              editor.getSession().getUndoManager().redo(false);
            },
            readOnly: false
        });
	      editor.saveUrl = function(){
	        httpPost(file, editor.getValue()+"", type);
	      }
        editor.loadUrl = function(filename, lang, type){
          file = filename;
          if(typeof file === "undefined") return file = "/index.htm";
          if(typeof lang === "undefined")
            lang = getLangFromFilename(file);
          if(typeof type === "undefined"){
            type = "text/"+lang;
            if(lang === "c_cpp") type = "text/plain";
          }
          if(lang !== "plain") editor.getSession().setMode("ace/mode/"+lang);
          httpGet(file);
        }
        editor.loadUrl(file,lang,type);
        return editor;
      }
      $(function(){
        $(window).on('beforeunload',function() { return "Realy?"; });
        var vars = {};
        var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) { vars[key] = value; });
        var editor = createEditor("editor", vars.file, vars.lang, vars.theme);
        var tree = createTree("tree", editor);
        createFileUploader(".uploader", tree, editor);
      });
