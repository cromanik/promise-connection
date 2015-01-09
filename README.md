# Promise Connection [![build status](https://api.travis-ci.org/gnarf/promise-connection.svg)](https://travis-ci.org/gnarf/promise-connection/)

This library aims to provide a Promise generic implementation of a cross-window connection using MessageChannel in modern browsers.

## `promiseConnection.Promise`

You must define this before creating any `promiseConnection` objects, point it at whatever promise implementation you like.

```html
<script src='promise-connection.js'></script>
<script>promiseConnection.Promise = window.Promise</script>
```
