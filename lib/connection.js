var PC = require('../index');

function Connection(port, local, options) {
  options = options || {};
  PC.assert(port && port.postMessage, 'port must implement postMessage');
  PC.assert(PC.Promise, 'Can not create a Connection without setting PC.promise');
  this.local = local;
  this.options = options;

  port.onmessage = this.handleEvent.bind(this);
}

Connection.prototype.handleEvent = function(event) {
  console.log('got message', event.data);
};

module.exports = Connection;
