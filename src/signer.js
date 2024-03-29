// @flow

import stringify from 'json-stringify-deterministic';
import NodeRSA from 'node-rsa';

export default (key:any, format?:string = 'pkcs1-private-pem') => {
  const privateKey = key instanceof NodeRSA ? key : new NodeRSA(key, format);
  return (...args:Array<any>) => privateKey.sign(stringify(args), 'base64', 'utf8');
};
