var UUID = require('./lib/uuid');
var object = require('./lib/object');
var PC = module.exports = {
  assert: require('./lib/assert'),
  extend: object.extend,
  Promise: undefined,
  UUID: UUID,
};

PC.Connection = require('./lib/connection');
