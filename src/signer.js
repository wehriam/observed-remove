// @flow

const stringify = require('json-stringify-deterministic');
const NodeRSA = require('node-rsa');

module.exports = (key:any, format?:string = 'pkcs1-private-pem') => {
  const privateKey = key instanceof NodeRSA ? key : new NodeRSA(key, format);
  return (...args:Array<any>) => privateKey.sign(stringify(args), 'base64', 'utf8');
};
