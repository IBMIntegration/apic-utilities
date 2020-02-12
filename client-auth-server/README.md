# Log target requiring client auth

The file server.js is a node.js server that listens on port 4433 for a POST request to a URL of the form /file/<filename> and will append to the specified file.  It requires client authentication with the following files:

- client1-key.pem
- client1-crt.pem
- ca-crt.pem
