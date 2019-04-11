//      

const stringify = require('json-stringify-deterministic');
const NodeRSA = require('node-rsa');

module.exports = (key    , format         = 'pkcs1-private-pem') => {
  const privateKey = key instanceof NodeRSA ? key : new NodeRSA(key, format);
  return (...args           ) => privateKey.sign(stringify(args), 'base64', 'utf8');
};
