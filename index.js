var UUID = require('./lib/uuid');
var PC = module.exports = {
  assert: require('./lib/assert'),
  Promise: undefined,
  UUID: UUID,
};

PC.Connection = require('./lib/connection');
