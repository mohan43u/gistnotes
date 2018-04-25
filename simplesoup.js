/*
 * simplesoup.js - simple libsoup wrapper
 */

const Lang = imports.lang;
const Signals = imports.signals;
const Format = imports.format;
String.prototype.format = Format.format;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;

const SimpleSoupError = function(errormsg) {
    this.message = errormsg;
}
SimpleSoupError.prototype = new Error();

var SimpleSoup = new Lang.Class({
    Name: "SimpleSoup",
    Signals: {
	'progress': {}
    },
    _init: function(props) {
	this.user_agent = props.user_agent || 'simplesoup.js';
	this.chunk_size = props.chunk_size || 4098;
	this.debug = props.debug || GLib.getenv("SOUP_DEBUG");
    },
    _emit_progress: function(part, whole) {
	if(whole) {
	    this.emit('progress', part/(typeof(whole) == "string" ? parseFloat(whole) : whole));
	}
    },
    call: function(method, url, request, cancellable, callback) {
	cancellable = cancellable || null;
	let soup = new Soup.Session();
	let souprequest = soup.request_http(method, url);
	let message = souprequest.get_message();
	let headers = message['request-headers'];
	let response = {"headers": {}};

	if(this.debug) {
	    let debuglevel = {"minimal": Soup.LoggerLogLevel.MINIMAL,
			      "headers": Soup.LoggerLogLevel.HEADERS,
			      "body": Soup.LoggerLogLevel.BODY};
	    let debug = debuglevel[this.debug] || debuglevel['body'];
	    soup['add-feature'] = Soup.Logger.new(debug, -1);
	}

	headers.append("User-Agent", this.user_agent);
	message.connect("got-headers", Lang.bind(response, function(message) {
	    this.statuscode = message['status-code'];
	    message['response-headers'].foreach(Lang.bind(this, function(name, value) {
		this.headers[name] = value;
	    }));
	}));
	
	if(request) {
	    if(request.headers) {
		for(let header in request.headers) {
		    headers.append(header, request.headers[header]);
		}
	    }
	    if(request.body) {
		message.set_request(headers.get('Content-Type') || 'text/plain',
				    Soup.MemoryUse.COPY,
				    request.body);
	    }
	}
	this._emit_progress(0.02, 1);
	if(callback) {
	    souprequest.send_async(cancellable,
				   Lang.bind(this, function(soup,
							    asyncresult,
							    cancellable,
							    callback,
							    response) {
				       let stream = soup.send_finish(asyncresult);
				       stream.result = '';
				       stream.resultsize = 0;
				       stream.chunk_size = this.chunk_size;
				       stream.callback = Lang.bind(this, function(stream,
										  asyncresult,
										  cancellable,
										  callback,
										  response) {
					   let result = stream.read_bytes_finish(asyncresult);
					   let size = result.get_size();
					   if(size > 0) {
					       stream.resultsize += size;
					       this._emit_progress(stream.resultsize, response.headers['Content-Length']);
					       stream.result += result.get_data().toString();
					       stream.read_bytes_async(stream.chunk_size,
								       GLib.PRIORITY_DEFAULT,
								       cancellable,
								       stream.callback);
					   }
					   else {
					       response.body = stream.result;
					       this._emit_progress(1, 1);
					       callback(response);
					   }
				       }, cancellable, callback, response);
				       stream.read_bytes_async(stream.chunk_size,
							       GLib.PRIORITY_DEFAULT,
							       cancellable,
							       stream.callback);
				   }, cancellable, callback, response));
	    return true;
	}
	else {
	    let stream = souprequest.send(cancellable);
	    stream.result = '';
	    stream.resultsize = 0;
	    stream.chunk_size = response.chunk_size;
	    while(true) {
		let result = stream.read_bytes(stream.chunk_size, cancellable);
		let size = result.get_size();
		if(size <= 0) break;
		stream.resultsize += size;
		this._emit_progress(stream.resultsize, response.headers['Content-Length']);
		stream.result += result.get_data().toString();
	    }
	    response.body = stream.result;
	    this._emit_progress(1, 1);
	    return response;
	}
    }
});
Signals.addSignalMethods(SimpleSoup.prototype);
