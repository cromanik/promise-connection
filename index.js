var UUID = require('./lib/uuid');
var PC = module.exports = {
  UUID: UUID,
  Promise: undefined
};

PC.Connection = require('./lib/connection');
