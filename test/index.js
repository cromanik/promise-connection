var expect = chai.expect;

function MockPort() {}

MockPort.prototype.postMessage = function() {};
MockPort.prototype.onmessage = function() {};

describe('promiseConnection', function() {
  beforeEach(function() {
    // ensure Promise is defined for every test
    expect(window.Promise).to.be.a('function');
    promiseConnection.Promise = window.Promise;
  });

  it('should define promiseConnection', function() {
    expect(promiseConnection).to.be.ok;
  });

  describe("Connection", function() {
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
  });

});
