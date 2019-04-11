//      

const stringify = require('json-stringify-deterministic');
const NodeRSA = require('node-rsa');

module.exports = (key    , format         = 'pkcs1-public-pem') => {
  const publicKey = key instanceof NodeRSA ? key : new NodeRSA(key, format);
  return (signature       , ...args           ) => publicKey.verify(stringify(args), signature, 'utf8', 'base64');
};
