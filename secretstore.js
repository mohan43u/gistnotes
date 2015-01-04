/*
 * secretstore.js - to save data in libsecret
 */

const Lang = imports.lang;
const System = imports.system;
const Format = imports.format;
String.prototype.format = Format.format;

const GLib = imports.gi.GLib;
const Secret = imports.gi.Secret;

const SecretStoreError = function(errormsg) {
    this.message = errormsg;
}
SecretStoreError.prototype = new Error();

const SecretStore = new Lang.Class({
    Name: "SecretStore",
    _init: function(props) {
	props = props || {};
	this.name = props.name || 'org.' + GLib.path_get_basename(System.programInvocationName);
	this.schema = props.schema || Secret.Schema.new(this.name,
							Secret.SchemaFlags.NONE,
							{'key': Secret.SchemaAttributeType.STRING});
    },
    store: function(key, value, attributes, cancellable, callback) {
	cancellable = cancellable || null;
	if(callback) {
	    Secret.password_store(this.schema,
				  attributes || {'key': key},
				  Secret.COLLECTION_DEFAULT,
				  key,
				  value,
				  cancellable,
				  Lang.bind(this, function(source, result, callback) {
				      callback(Secret.password_store_finish(result));
				  }, callback));
	    return true;
	}
	else {
	    return Secret.password_store_sync(this.schema,
					      attributes || {'key': key},
					      Secret.COLLECTION_DEFAULT,
					      key,
					      value,
					      cancellable);
	}
    },
    retrive: function(key, attributes, cancellable, callback) {
	cancellable = cancellable || null;
	if(callback) {
	    Secret.password_lookup(this.schema,
				   attributes || {'key': key},
				   cancellable,
				   Lang.bind(this, function(source, result, callback) {
				       callback(Secret.password_lookup_finish(result));
				   }, callback));
	    return true;
	}
	else {
	    return Secret.password_lookup_sync(this.schema,
					       attributes || {'key': key},
					       cancellable);
	}
    },
    remove: function(key, attributes, cancellable, callback) {
	cancellable = cancellable || null;
	if(callback) {
	    Secret.password_clear(this.schema,
				  attributes || {'key': key},
				  cancellable,
				  Lang.bind(this, function(source, result, callback) {
				      callback(Secret.password_clear_finish(result));
				  }, callback));
	    return true;
	}
	else {
	    return Secret.password_clear_sync(this.schema,
					      attributes || {'key': key},
					      cancellable);
	}
    }
});
