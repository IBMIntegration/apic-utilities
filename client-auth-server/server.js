var fs = require('fs');
var https = require('https');
var url = require('url');
var os = require("os");

var options1 = {
    key: fs.readFileSync('server-key.pem'),
    cert: fs.readFileSync('server-crt.pem'),
    ca: fs.readFileSync('ca-crt.pem'),
    requestCert: true,
    rejectUnauthorized: true
};

// Server 1 is the secured server to which a client can POST some data
// and it is appended to the file.

var server1 = https.createServer(options1, function (req, res) {

  switch (req.method) {
    case 'GET':
      console.log(new Date()+' '+
      req.connection.remoteAddress+' '+
      req.socket.getPeerCertificate().subject.CN+' '+
      req.method+' '+req.url);
      res.writeHead(200);
      res.write("Secure file write test\n");
      break;

    case 'POST':
      console.log(new Date()+' '+
        req.connection.remoteAddress+' '+
        req.socket.getPeerCertificate().subject.CN+' '+
        req.method+' '+req.url);
      var resource = req.url.split('/')[1];
      if (!(resource === 'file')) {
        console.log(new Date()+' Resource type ' + resource + ' not found');
        res.writeHead(404);
        break;
      }
      var filename = req.url.split('/')[2];
      console.log(new Date()+' Filename ', filename);
      let data = []
      req.on('data', chunk => {
        // Collect a new chunk and push to array
        data.push(chunk)
      });
      req.on('end', () => {
        // Write file
        console.log(new Date()+' Data: ' + data);

        fs.appendFile(filename, data + os.EOL, function (err) {
          if (err) {
            console.log(new Date()+' Error writing file');
            console.log(err);
            res.writeHead(500);
            res.end();
          }
          console.log(new Date()+' File ' + filename + ' written successfully');
          res.writeHead(200);
        });
      })
      break;
  }

  res.end();

}).listen(4433);

// Server 2 does not require authentication and allows the files to be read for
// debugging purposes

var options2 = {
    key: fs.readFileSync('server-key.pem'),
    cert: fs.readFileSync('server-crt.pem'),
    ca: fs.readFileSync('ca-crt.pem'),
    requestCert: false,
    rejectUnauthorized: false
};

var server2 = https.createServer(options2, function (req, res) {

  switch (req.method) {
    case 'GET':
      console.log(new Date()+' '+
        req.connection.remoteAddress+' '+
        req.method+' '+req.url);

      var resource = req.url.split('/')[1];
      if (!(resource === 'file')) {
        console.log(new Date()+' Resource type ' + resource + ' not found');
        res.writeHead(404);
        break;
      }
      var filename = req.url.split('/')[2];
      console.log(new Date()+' Filename ', filename);

      if (!fs.existsSync(filename)) {
        console.log(new Date()+' Resource ' + resource + ' not found');
        res.writeHead(404);
        break;
      }
      var fileContents = fs.readFileSync(filename);
      console.log(new Date()+' File read successfully');
      res.writeHead(200);
      res.write(fileContents);
      break;

    case 'POST':
      res.writeHead(405);
      res.write("POST not supported");
      break;
  }
  res.end();
}).listen(5433);
