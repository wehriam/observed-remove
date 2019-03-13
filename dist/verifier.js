//      

const hasher = require('./hasher');
const NodeRSA = require('node-rsa');

module.exports = (key    , format         = 'pkcs1-public-pem') => {
  const publicKey = key instanceof NodeRSA ? key : new NodeRSA(key, format);
  return (signature       , ...args           ) => publicKey.verify(hasher(args), signature, 'utf8', 'base64');
};
