var PC = require('../index');

function Connection(port, local, options) {
  options = options || {};
  PC.assert(PC.Promise, 'promiseConnection.Promise must be defined');
  PC.assert(port && port.postMessage, 'port must implement postMessage');
  this.local = local;
  this.options = options;

  port.onmessage = this._onmessage.bind(this);
}

Connection.prototype._onmessage = function(event) {
  console.log('got message', event.data);
};

module.exports = Connection;
