const express = require('express');

const app = express();

app.get('/', function (req, res) {
  res.send('Hello World');
});

const portNumber = process.env.PORT || 4444;
app.listen(portNumber);
console.log(
  'Server listening on 0.0.0.0 port ' + portNumber +
  ' (http://0.0.0.0:' + portNumber + '/)'
);
