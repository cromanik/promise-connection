var PC = require('../index');

function Connection(port, local, options) {
  local = local || {};
  options = PC.extend({}, options);
  PC.assert(PC.Promise, 'promiseConnection.Promise must be defined');
  PC.assert(port && port.postMessage, 'port must implement postMessage');
  this.port = port;
  this.local = local;
  this.options = options;

  // default options:
  if (!('autoConnect' in this.options)) {
    this.options.autoConnect = true;
  }

  this._pending = {};
  this.port.onmessage = this._onmessage.bind(this);

  var connection = this;

  this.connected = new Promise(function(resolve, reject) {
    connection._connectResolve = resolve;
    connection._connectReject = reject;
  }).then(function() {
    connection._connected = true;
    delete connection._connectResolve;
    delete connection._connectReject;
    delete connection._connecting;
    delete connection._pending['connect'];
    return connection;
  });

  if (this.options.autoConnect) {
    this.connect();
  }
}

Connection.prototype._onmessage = function(event) {
  var data = event.data;
  if (!data._pc || (this.options.messageKey && data._key !== this.options.messageKey)) {
    // console.warn('dropping message from invalid source');
    return;
  }

  if (data._type === 'resolve' || data._type === 'reject') {
    var pending = this._pending[data._id];
    if (!pending) {
      console.error('received ' + data._type + ' for unknown promise');
      return;
    }
    delete this._pending[data._id];
    return pending[data._type](this.unserialize(data.value));
  }

  var connection = this;
  var handler = function(type) {
    return function(value) {
      connection._post({
        _type: type,
        _id: data._id,
        value: value
      });
    };
  };

  var result = Promise.resolve()
    .then(function() {
      if (data._type === 'connect') {
        if (connection._connecting) {
          connection._connectResolve();
        } else {
          connection.connect();
        }
        return connection.connected;
      }
      if (data._type === 'invoke') {
        var method = connection.local[data.method];
        if (!method) {
          throw new Error('PromiseConnection: Unknown method ' + data.method);
        }
        return method.apply(connection.local, connection.unserialize(data.args));
      }
    })
    .then(handler('resolve'), handler('reject'));
};

Connection.prototype.serialize = function(obj) {
  if (obj instanceof Error) {
    var copy = {
      _pc: 'error',
      message: obj.message,
      number: obj.number
    };
    if (this.options.debug) {
      console.error('PromiseConnection: Transmitting Error: ');
      console.error(obj.stack || obj);
    }
    return copy;
  }
  if (obj instanceof Connection) {
    if (this.options.debug) {
      console.error('PromiseConnection: Refusing to transmit Connection object');
    }
    return null;
  }
  if (obj && obj.map) {
    return obj.map(this.serialize);
  }
  return obj;
};

Connection.prototype.unserialize = function(obj) {
  if (obj && obj.map) {
    return obj.map(this.unserialize);
  }
  if (obj && obj._pc === 'error') {
    var error;
    if (obj.number === undefined) {
      error = new Error(obj.message);
    } else {
      error = new Error(obj.number, obj.message);
    }
    return error;
  }
  return obj;
};

Connection.prototype.connect = function() {
  if (this._connected) {
    return this.connected;
  }
  if (!this._connecting) {
    // initial connection
    this._connecting = true;
    this._post({
      _id: 'connect',
      _type: 'connect'
    }).then(this._connectResolve, this._connectReject);
  } else if (this._pending['connect']) {
    // retransmit conection request
    this.port.postMessage(this._pending['connect'].data);
  }

  return this.connected;
};

Connection.prototype.invoke = function(method, args) {
  if (!args) {
    args = [];
  }
  return this._post({ _type: 'invoke', method: method, args: args });
};

Connection.prototype._post = function(data) {
  data = PC.extend({}, data);
  data._pc = true;
  data._key = this.options.messageKey;
  data._id = data._id || PC.UUID();

  var clearPending = function(id) {
    delete this._pending[id]
  }.bind(this, data._id);

  if (data.value) {
    data.value = this.serialize(data.value);
  }

  if (data.args) {
    data.args = this.serialize(data.args);
  }

  var result = new Promise(function(resolve, reject) {
    this._pending[data._id] = {
      data: data,
      resolve: resolve,
      reject: reject
    };
    this.port.postMessage(data);
  }.bind(this));
  // clear the pending request when we get our result
  result.then(clearPending, clearPending);
  // return the result promise
  return result;
};

module.exports = Connection;
