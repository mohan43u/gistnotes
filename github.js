/*
 * github.js - github api using github-provider
 */

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const System = imports.system;
const Signals = imports.signals;
const SimpleSoup = imports.simplesoup;
const SecretStore = imports.secretstore;
const Format = imports.format;
String.prototype.format = Format.format;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Soup = imports.gi.Soup;
const WebKit = imports.gi.WebKit;

const WEBKIT_USER_AGENT = 'Mozilla/5.0 (GNOME; not Android) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile';
const API = {
    'authorize': 'https://github.com/login/oauth/authorize',
    'access_token': 'https://github.com/login/oauth/access_token',
    'root': "https://api.github.com",
    'me': '/user',
    'gists': {
	'user-gists': '/users/%s/gists',
	'user-public-gists': '/gists',
	'user-starred-gists': '/gists/starred',
	'public-gists': '/gists/public',
	'id': '/gists/%s',
	'create': '/gists'
    }
};

const GithubError = function(errormsg) {
    this.message = errormsg;
}
GithubError.prototype = new Error();

const Github = new Lang.Class({
    Name: "GitHub",
    Signals: {
	'authorize-error': {},
	'authorize-done': {},
	'init-done': {}
    },
    _init: function(props) {
	props = props || {};
	this.app = props.app || GLib.path_get_basename(System.programInvocationName);
	this.client_id = props.client_id || 'cc61935b01f65cf262a5';
	this.client_secret = props.client_secret || '40190a8926b434bd43f630b03113805f2a47d196';
	this.redirect_uri = props.redirect_uri || 'https://github.com/mohan43u/gistnotes';
	this.scope = props.scope || 'gist';
	this.soup = props.soup || new SimpleSoup.SimpleSoup({"user_agent": this.app});
	this.store = props.store || new SecretStore.SecretStore({"app": this.app});
	this.defaultrequest = {'headers': {'Accept': 'application/json',
					   'Accept-Encoding': ''}};
    },
    _retrive_access_token: function() {
	let body = null;
	let request = null;
	
	body = 'client_id=' + this.client_id;
	body += '&client_secret=' + this.client_secret;
	body += '&code=' + this.code;
	body += '&redirect_uri=' + escape(this.redirect_uri);
	request = this.defaultrequest;
	request.headers['Content-Type'] = 'application/x-www-form-urlencoded';
	request.body = body;
	this.soup.call('POST',
		       API['access_token'],
		       request,
		       null,
		       Lang.bind(this, function(response) {
			   if(response.statuscode == 200 && response.body) {
			       let body = JSON.parse(response.body);
			       if(body.access_token) {
				   for(let key in body) {
				       this[key] = body[key];
				   }
				   this.store.store('access_token',
						    this.access_token,
						    null,
						    null,
						    Lang.bind(this, function(result) {
							if(result) {
							    this.emit('authorize-done');
							}
						    }));
			       }
			   }
			   else {
			       this.emit('authorize-error');
			   }
		       }));
    },
    authorize: function() {
	Gtk.init_check(null);
	let window = new Gtk.Window();
	let scroll = new Gtk.ScrolledWindow();
	let screen = Gdk.Screen.get_default();
	let size = new Gdk.Geometry();
	let webkit = new WebKit.WebView();
	let settings = new WebKit.WebSettings();
	let url = null;

	window.set_title(GLib.path_get_basename(System.programInvocationName));
	window.connect('delete-event', Lang.bind(this, function(window) {
	    if(!this.code) {
		this.emit('authorize-error');
	    }
	}));
	size.min_width = (screen.get_width() * 25) / 100;
	size.min_height = (screen.get_height() * 80) / 100;
	window.set_geometry_hints(null, size, Gdk.WindowHints.MIN_SIZE);
	window.set_position(Gtk.WindowPosition.CENTER);
	settings['user-agent'] = WEBKIT_USER_AGENT;
	webkit.set_settings(settings);
	webkit.connect('resource-response-received', Lang.bind(this, function(webkit,
									      frame,
									      resource,
									      response,
									      window) {
	    if(response) {
		let message = response.get_message();
		let location = response.get_uri();
		
		if(message['status-code'] == 200
		   && location.search(this.redirect_uri) >= 0) {
		    this.code = (/code=([^&]*)/g).exec(location)[1];
		    window.close();
		    this._retrive_access_token();
		}
	    }
	}, window));
	url = API['authorize'];
	url += '?client_id=' + this.client_id;
	url += '&redirect_uri=' + escape(this.redirect_uri);
	url += '&scope=' + escape(this.scope);
	webkit.load_uri(url);
	scroll.add(webkit);
	window.add(scroll, true, true, 10);
	window.show_all();
    },
    _me: function() {
	this.soup.call('GET',
		       this._url(API['me']),
		       this.defaultrequest,
		       null,
		       Lang.bind(this, function(response) {
			   if(response.statuscode == 200) {
			       this.me = JSON.parse(response.body);
			       this.user_id = this.me.login;
			       this.emit('init-done');
			   }
			   else {
			       this.store.remove('access_token',
						 null,
						 null,
						 Lang.bind(this, function(result) {
						     if(result) print('access_token removed');
						     this.emit('authorize-error');
						 }));
			   }
		       }));
    },
    init: function() {
	this.store.retrive('access_token',
			   null,
			   null,
			   Lang.bind(this, function(access_token) {
			       if(access_token) {
				   this.access_token = access_token;
				   this._me();
			       }
			       else {
				   this.connect('authorize-done', function(self) {
				       self._me();
				   });
				   this.authorize();
			       }
			   }));
    },
    _url: function(path, params) {
	let u = "%s%s?access_token=%s".format(API['root'], path, this.access_token);
	let p = null;
	for(let k in params){
	    let s="%s=%s".format(k,params[k]);
	    (!p ? p = s : p += "&%s".format(s));
	}
	u = (p ? "%s&%s".format(u, p) : u);
	return u;
    },
    gists_list: function(type,
			 pageparams,
			 cancellable,
			 callback) {
	this.soup.call('GET',
		       this._url(API['gists'][type].format(this.user_id), pageparams),
		       this.defaultrequest,
		       cancellable,
		       callback);
    },
    gists_id: function(id,
		       cancellable,
		       callback) {
	this.soup.call('GET',
		       this._url(API['gists']['id'].format(id)),
		       this.defaultrequest,
		       cancellable,
		       callback);
    },
    gists_create: function(file,
			   description,
			   ispublic,
			   cancellable,
			   callback) {
	cancellable = cancellable || null;
	let post = {
	    "description": description,
	    "public": ispublic,
	    "files": {}
	};
	if(file.path) {
	    let giofile = Gio.File.new_for_path(file.path);
	    giofile.load_contents_async(null, Lang.bind(this, function(giofile,
								       asyncresult,
								       post,
								       cancellable,
								       callback) {
		let content = giofile.load_contents_finish(asyncresult)[1];
		post["files"][giofile.get_basename()] = {"content": content.toString()};
		let request = this.defaultrequest;
		request.body = JSON.stringify(post);
		return this.soup.call('POST',
				      this._url(API['gists']['create']),
				      request,
				      cancellable,
				      callback);
	    }, post, cancellable, callback));
	}
	else {
	    post["files"][file.name] = {"content": file.content};
	    let request = this.defaultrequest;
	    request.body = JSON.stringify(post);
	    let url = this._url(API['gists']['create']);
	    this.soup.call('POST',
			   url,
			   request,
			   cancellable,
			   callback);
	}
    },
    gists_delete: function(id,
			   cancellable,
			   callback) {
	this.soup.call('DELETE',
		       this._url(API['gists']['id'].format(id)),
		       this.defaultrequest,
		       cancellable,
		       callback);
    }
});
Signals.addSignalMethods(Github.prototype);
/*
  let mainloop = imports.mainloop;
  let github = new Github();
  github.connect('init-done', function(self) {
  self.gists_list('user-gists', null, null, function(response) { print(response.body); });
  });
  github.init();
  mainloop.run();
*/
