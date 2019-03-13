//      

const hasher = require('./hasher');
const NodeRSA = require('node-rsa');

module.exports = (key    , format         = 'pkcs1-private-pem') => {
  const privateKey = key instanceof NodeRSA ? key : new NodeRSA(key, format);
  return (...args           ) => privateKey.sign(hasher(args), 'base64', 'utf8');
};
