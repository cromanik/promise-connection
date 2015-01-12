module.exports = {
  extend: function(dest, src) {
    var index, src, keys, key;
    for(index=1; index<arguments.length; index++) {
      src = arguments[index];
      if (src && typeof src === 'object') {
        keys = Object.keys(src);
        while (key = keys.pop()) {
          dest[key] = src[key];
        }
      }
    }
    return dest;
  }
};
