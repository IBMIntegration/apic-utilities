var fs = require('fs');
var https = require('https');

if (process.argv.length != 6) {
  console.log('Usage: node client.js <host> <port> <filename> <content>');
  process.exit();
}

var host = process.argv[2];
var port = process.argv[3];
var filename = process.argv[4];
var content = process.argv[5];

var options = {
    hostname: host,
    port: port,
    path: '/file/' + filename,
    method: 'POST',
    key: fs.readFileSync('client1-key.pem'),
    cert: fs.readFileSync('client1-crt.pem'),
    ca: fs.readFileSync('ca-crt.pem')
};

var req = https.request(options, function(res) {
    res.on('data', function(data) {
        console.log(data);
    });
    console.log(res.statusCode);
});

req.write(content);
req.on('error', function(e) {
    console.error(e);
});
req.end();
