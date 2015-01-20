const PC = require('promise-connection');

function WindowBroker(options) {
  this.options = options || {};

  window.addEventListener('message', this);

  /**
   * Stores an object for each window with the following structure:
   *
   * {
   *   channels: {
   *     CHANNEL_NAME: {
   *       port: MessagePort, (undefined until channel is created)
   *       channel: Promise, (resolves with the channel when created)
   *       gotChannel: function, (removed after being called)
   *     }
   *   } 
   * }
   */
  this.windows = new WeakMap();

  this.factories = {};
}

WindowBroker.prototype.verifyEvent = function(event) {
  if (!this.windows.has(event.source)) {
    // event from unknown window
    return false;
  }
  if (!event.data._broker) {
    return false;
  }

  return true;
};

WindowBroker.prototype.handleEvent = function(event) {
  if (!this.verifyEvent(event)) {
    return;
  }

  var data = event.data;
  var method = data._broker;
  var type = data.type;
  var winData = this.windows.get(event.source);
  var localPort;

  if (method === 'request') {
    if (!this.factories[type]) {
      throw new Error('request for unknown factory: ' + type);
    }
    if (winData.channels[type] && winData.channels[type].port) {
      throw new Error('request for already established: ' + type);
    }

    var channel = new MessageChannel();
    localPort = channel.port1;

    event.source.postMessage({
      _broker: 'response',
      type: type
    }, event.origin, [channel.port2]);

  }

  if (method === 'response') {
    localPort = event.ports[0];
  }

  this._createConnection(event.source, type, localPort);
};

WindowBroker.prototype.addFactory = function(type, factory) {
  if (this.factories[type]) {
    throw new Error('Attempt to re-register ' + type);
  }
  this.factories[type] = factory;
};

WindowBroker.prototype.addWindow = function(win) {
  this.windows.set(win, {
    channels: {}
  });
}

WindowBroker.prototype._createConnection = function(win, type, port) {
  var channelData = this._channelData(win, type);
  if (channelData.port) {
    throw new Error('already created this port');
  }
  channelData.port = port;
  var broker = this;
  var factory = this.factories[type];

  Promise.resolve()
    .then(function() {
      return factory.call(broker, {
        broker: broker,
        type: type,
        window: win,
        // in case the factory wants to wait for connected to start something
        channel: channelData.channel,
      });
    })
    .then(function(localAPI) {
      return (new PC.Connection(port, localAPI, { debug: true })).connected;
    })
    .then(channelData.gotChannel)
    .catch(function(error) {
      console.error('Got Error while settig up WindowBroker Channel');
      console.error(error.stack || error);
    });
};

WindowBroker.prototype._channelData = function(win, type, create) {
  if (!this.windows.has(win)) {
    this.addWindow(win);
  }
  var winData = this.windows.get(win);
  var channelData = winData.channels[type];
  if (!channelData) {
    channelData = winData.channels[type] = {};
  }
  // default to creating, there is only one "read only" case
  if (!channelData.channel && create !== false) {
    channelData.channel = new Promise(function(resolve, reject) {
      channelData.gotChannel = resolve;
    });
    channelData.channel.then(function() {
      delete channelData.gotChannel;
    });
  }
  return channelData;
};

WindowBroker.prototype.request = function(win, type) {
  if (!this.factories[type]) {
    throw new Error('request for unknown factory: ' + type);
  }
  if (!this.windows.has(win)) {
    this.addWindow(win);
  }
  var channelData = this._channelData(win, type, false);
  if (channelData.channel) {
    return channelData.channel;
  }
  win.postMessage({ _broker: 'request', type: type }, '*');
  return this._channelData(win, type).channel;
};

WindowBroker.prototype.open = function(url, windowName, features) {
  var win = window.open(url, windowName, features);
  this.addWindow(win);
  return win;
};

module.exports = WindowBroker;
