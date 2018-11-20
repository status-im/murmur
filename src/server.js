const express = require('express');
const bodyParser = require('body-parser')
const app = express();
const expressWs = require('express-ws')(app);

const Provider = require('./provider');
const provider = new Provider();

const node = require('./index.js');

const Manager = require('./manager')
const manager = new Manager(node, provider)

app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())

app.ws('/', function(ws, req) {
  ws.on('message', function(msg) {
    console.dir(msg);
    provider.sendAsync(JSON.parse(msg), (err, jsonResponse) => {
      if (err) {
        console.dir(err);
        ws.send({error: err});
      }
      console.dir(jsonResponse);
      ws.send(JSON.stringify(jsonResponse));
    })
  });
});

app.listen(8546, () => console.log('Murmur listening on port 8546!'));
