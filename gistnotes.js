#!/usr/bin/env gjs

/*
 * gistnotes.js - app to add/remove/view gists
 */

const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;
const System = imports.system;
const Format = imports.format;
String.prototype.format = Format.format;
imports.searchPath.unshift(GLib.path_get_dirname(System.programInvocationName));
const Github = imports.github;
const Ui = imports.ui;

const GistNotesError = function(errormsg) {
    this.message = errormsg;
}
GistNotesError.prototype = new Error();

const GistNotes = new Lang.Class({
    Name: 'GistNotes',
    Signals: {
	'init-done': {}
    },
    _init: function(props) {
	props = props || {};
	this.github = props.github || new Github.Github();
	this.ui = props.ui || new Ui.Ui();
	this.github.connect('authorize-error', Lang.bind(this.ui, this.ui.quit));
	this.github.connect('init-done', Lang.bind(this, this._init_done_cb));
	this.github.soup.connect('progress', Lang.bind(this, this._progress_cb));
	this.github.init();
    },
    run: function(argv) {
	return this.ui.run(argv);
    },
    _get_content: function(url, callback) {
	this.github.soup.call('GET',
			      url,
			      this.github.defaultrequest,
			      null,
			      Lang.bind(this, function(response, callback) {
				  if(response.statuscode == 200) {
				      callback(response.body);
				  }
				  else {
				      this._handle_error(response);
				  }
			      }, callback));
    },
    _handle_gist: function(gist, content) {
	for(let filename in gist.files) {
	    let file = gist.files[filename];
	    file.filename = filename;
	    file.gist = gist;
	    if(!gist.fileobjects) gist.fileobjects = [];
	    gist.fileobjects.unshift(file);
	    file.content = content && typeof(content) == 'string' ? content : Lang.bind(this, this._get_content);
	    this.ui.add_file(file);
	}
    },
    _more_cb: function(link) {
	this.github.soup.call('GET',
			      link,
			      this.github.defaultrequest,
			      null,
			      Lang.bind(this, this._handle_gists_list));
    },
    _handle_gists_list: function(response) {
	if(response.statuscode == 200) {
	    if(response.headers['Link']) {
		let link = response.headers['Link'].split(',')[0].split(';')[0].replace(/[<>]/g, '');
		this.ui.enable_more(Lang.bind(this, this._more_cb, link));
	    }
	    let gists = JSON.parse(response.body);
	    for(let index = gists.length - 1; index >= 0; index--) {
		this._handle_gist(gists[index]);
	    }
	}
	else {
	    this._handle_error(response);
	}
    },
    _handle_gists_delete: function(file) {
	if(file && file.gist.owner && file.gist.owner.login == this.github.user_id) {
	    this.github.gists_delete(file.gist.id,
				     null,
				     Lang.bind(this, function(response, file) {
					 if(response.statuscode == 204) {
					     for(let fileobject of file.gist.fileobjects) {
						 this.ui.remove_file(fileobject);
					     }
					 }
					 else {
					     this._handle_error(response);
					 }
				     }, file));
	}
    },
    _init_done_cb: function() {
	this.ui.add_delete_handler(Lang.bind(this, this._handle_gists_delete));
	
	this.ui.add_save_handler(Lang.bind(this, function(filename,
							  filecontent,
							  description,
							  ispublic,
							  file) {
	    this._handle_gists_delete(file);
	    this.github.gists_create({'name': filename, 'content': filecontent},
				     description,
				     ispublic,
				     null,
				     Lang.bind(this, function(response, content) {
					 if(response.statuscode == 201) {
					     this._handle_gist(JSON.parse(response.body), content);
					 }
					 else {
					     this._handle_error(response);
					 }
				     }, filecontent));
	}));
	
	this.ui.add_list_handlers({
	    'user-gists': Lang.bind(this, function() {
		this.github.gists_list('user-gists',
				       null,
				       null,
				       Lang.bind(this, this._handle_gists_list));
	    }),
	    'user-public-gists': Lang.bind(this, function() {
		this.github.gists_list('user-public-gists',
				       null,
				       null,
				       Lang.bind(this, this._handle_gists_list));
	    }),
	    'user-starred-gists': Lang.bind(this, function() {
		this.github.gists_list('user-starred-gists',
				       null,
				       null,
				       Lang.bind(this, this._handle_gists_list));
	    }),
	    'public-gists': Lang.bind(this, function() {
		this.github.gists_list('public-gists',
				       null,
				       null,
				       Lang.bind(this, this._handle_gists_list));
	    })
	});
    },
    _progress_cb: function(soup, fraction) {
	this.ui.progress_handler(fraction);
    },
    _handle_error: function(response) {
	this.ui.show_message('[' + response.statuscode + '] ' + response.body);
    }
});
Signals.addSignalMethods(GistNotes.prototype);

function main() {
    let gistnotes = new GistNotes();
    return gistnotes.run(ARGV);
}

main();
