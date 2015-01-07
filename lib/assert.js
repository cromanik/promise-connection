module.exports = function assert(cond, message) {
  if (!cond) {
    throw new Error(message);
  }
};

