var expect = chai.expect;
var debug = false;

// fake MessageChannel for firefox or other non-chromy tests
if (!window.MessageChannel) {
  window.MessageChannel = function() {
    var port1 = new MockPort();
    var port2 = new MockPort();
    port1.postMessage = function(data) {
      setTimeout(function() {
        port2.onmessage({ data: data });
      });
    };
    port2.postMessage = function(data) {
      setTimeout(function() {
        port1.onmessage({ data: data });
      });
    };
    return {
      port1: port1,
      port2: port2
    };
  }
}

function MockPort() {
  this.postMessage = sinon.spy();
}

MockPort.prototype.recvmock = function(data) {
  this.onmessage({ data: promiseConnection.extend({ _pc: true } , data) });
};

MockPort.prototype.onmessage = function() {};

describe('promiseConnection', function() {
  beforeEach(function() {
    expect(window.Promise).to.be.a('function');
    promiseConnection.Promise = window.Promise;
  });

  it('should define promiseConnection', function() {
    expect(promiseConnection).to.be.ok;
  });

  describe(".Connection()", function() {
    var Connection = promiseConnection.Connection;

    it('is a function', function() {
      expect(Connection).to.be.a('function');
    });

    it('throws an error when Promise is not defined', function() {
      expect(function() {
        delete promiseConnection.Promise;
        new Connection(new MockPort(), {})
      }).to.throw('promiseConnection.Promise must be defined');
    });

    describe('opts: { autoConnect: false }', function() {
      var port, local, options, connection;
      beforeEach(function() {
        port = new MockPort();
        local = {
        };
        options = {
          autoConnect: false
        };
        connection = new Connection(port, local, options)
      });

      it('does not send any message on creation with autoConnect: false', function() {
        expect(port.postMessage.called).to.be.false;
      });

      describe('.connect()', function() {
        beforeEach(function() {
          // the promise returned by connect should always equal "connected"
          expect(connection.connect()).to.equal(connection.connected);
        }); 

        it('sends a connect message when you call .connect()', function() {
          expect(port.postMessage.callCount).to.equal(1);
          var messageArgs = port.postMessage.args[0];
          expect(messageArgs[0]._id).to.equal('connect');
          expect(messageArgs[0]._type).to.equal('connect');
        });

        it('resolves connection when remote responds', function() {
          expect(connection._connecting).to.be.ok;
          expect(connection._connected).to.not.exist;
          port.recvmock({ _type: 'resolve', _id: 'connect', value: true })
          return connection.connected.then(function() {
            expect(connection._connecting).to.not.exist;
            expect(connection._connected).to.be.ok;
          });
        });

        it('resends connection packet when you call .connect() a second time', function() {
          // the promise returned by connect should always equal "connected"
          var originalArgs = port.postMessage.args[0];
          port.postMessage.reset();

          expect(connection.connect()).to.equal(connection.connected);
          expect(port.postMessage.callCount).to.equal(1);
          expect(port.postMessage.args[0]).to.deep.equal(originalArgs);
        });
      });

      describe('incoming connect', function() {
        beforeEach(function() {
          expect(connection._connecting).to.be.not.ok
          port.recvmock({ _type: 'connect', _id: 'connect' });
          // let promise resolvers tick before moving on to tests
          return Promise.resolve();
        });

        it('sends its own connection', function() {
          expect(port.postMessage.callCount).to.equal(1);
          var data = port.postMessage.args[0][0];
          expect(data._type).to.equal('connect');
        });

        it('becomes connected when remote replies', function() {
          expect(connection._connecting).to.be.ok;
          expect(connection._connected).to.not.exist;
          port.postMessage.reset();
          port.recvmock({ _type: 'resolve', _id: 'connect', value: true })
          return connection.connected.then(function() {
            expect(connection._connecting).to.not.exist;
            expect(connection._connected).to.be.ok;

            return Promise.resolve();
          }).then(function() {
            // and make sure it tells the other side it's connected
            expect(port.postMessage.callCount).to.equal(1);
            var data = port.postMessage.args[0][0];
            expect(data._type).to.equal('resolve');
            expect(data._id).to.equal('connect');

          });
        });
      });

    });

    describe('opts: {}', function() {
      var port, local, options, connection;
      beforeEach(function() {
        port = new MockPort();
        local = {};
        options = {};
        connection = new Connection(port, local, options)
      });

      it('sends a connect message immediately', function() {
        expect(port.postMessage.callCount).to.equal(1);
        var messageArgs = port.postMessage.args[0];
        expect(messageArgs[0]._id).to.equal('connect');
        expect(messageArgs[0]._type).to.equal('connect');
      });

      describe('incoming connect', function() {
        beforeEach(function() {
          port.postMessage.reset();
          expect(connection._connecting).to.be.ok;
          port.recvmock({ _type: 'connect', _id: 'connect' });
          // let promise resolvers tick before moving on to tests
          return Promise.resolve();
        });

        it('does not resend its own connection', function() {
          expect(port.postMessage.callCount).to.equal(0);
        });

        it('became connected', function() {
          // this became connected because it had already sent a "connect"
          return connection.connected.then(function() {
            expect(connection._connecting).to.not.exist;
            expect(connection._connected).to.be.ok;
            return Promise.resolve();
          }).then(function() {
            // and make sure it tells the other side it's connected
            expect(port.postMessage.callCount).to.equal(1);
            var data = port.postMessage.args[0][0];
            expect(data._type).to.equal('resolve');
            expect(data._id).to.equal('connect');
          });
        });
      });
    });

    describe('on a MessageChannel', function() {
      var ports, local, remote;
      beforeEach(function() {
        ports = new MessageChannel();
        options = {};
        local = new Connection(ports.port1, {}, { debug: debug });
        remote = new Connection(ports.port2, {}, { debug: debug });

        return local.connected;
      });
      it('conneted', function() {
        expect(remote._connected).to.be.ok;
        expect(local._connected).to.be.ok;
      });

      it('rejects an undefined method invoke', function() {
        return local.invoke('noMethod').then(function() {
          throw new Error('unexpected success');
        }, function(e) {
          expect(e.message).to.equal('PromiseConnection: Unknown method noMethod');
          expect(e.number).to.equal(undefined);
        });
      });

      it('calls remote method', function() {
        remote.local.method = sinon.spy(function() {
          return Math.random();
        });
        var args = [1, 2, 3];
        return local.invoke('method', args)
          .then(function(result) {
            expect(remote.local.method.callCount).to.equal(1);
            expect(result).to.equal(remote.local.method.returnValues[0]);
            expect(remote.local.method.args[0]).to.deep.equal(args);
          });
      });

      describe('remote promises', function() {
        var promise, resolve, reject, result;
        beforeEach(function() {
          promise = new Promise(function(res, rej) {
            resolve = res;
            reject = rej;
          });
          var remoteCalled;
          var gotRemote = new Promise(function(resolve) {
            remoteCalled = resolve
          });
          remote.local.promise = sinon.spy(function() {
            remoteCalled();
            return promise;
          });
          result = local.invoke('promise');

          return gotRemote;
        });

        it('does not resolve or reject', function() {
          var invalid = false;
          function invalidate() { invalid = true; }
          // should not reply yet
          result.then(invalidate, invalidate);
          expect(remote.local.promise.callCount).to.equal(1);
          return Promise.resolve()
            .then(function() {
              expect(invalid).to.be.false;
            });
        });
        it('resolves on resolve', function() {
          var obj = { test: true };
          resolve(obj);
          return result.then(function(result) {
            expect(result).to.deep.equal(obj)
          });
        });
        it('rejects on reject', function() {
          var obj = { test: true };
          reject(obj);
          return result.then(function() {
            throw new Error('unexpected resolve')
          }, function(result) {
            expect(result).to.deep.equal(obj)
          });
        });
      });

    });
  });

  describe('.extend()', function() {
    var fix1 = { fix1: true, fix2: false };
    var fix2 = { fix2: true };
    var expected = { fix1: true, fix2: true };

    it('copies keys from multiple objects into one', function() {
      var dest = {};
      var result = promiseConnection.extend(dest, fix1, fix2);
      expect(result).to.deep.equal(expected);
      expect(result).to.equal(dest);
    });
  });

});
