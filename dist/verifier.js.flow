// @flow

const stringify = require('json-stringify-deterministic');
const NodeRSA = require('node-rsa');

module.exports = (key:any, format?:string = 'pkcs1-public-pem') => {
  const publicKey = key instanceof NodeRSA ? key : new NodeRSA(key, format);
  return (signature:string, ...args:Array<any>) => publicKey.verify(stringify(args), signature, 'utf8', 'base64');
};
