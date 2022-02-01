import stringify from 'json-stringify-deterministic';
import NodeRSA from 'node-rsa';
export default ((key, format = 'pkcs1-private-pem') => {
  const privateKey = key instanceof NodeRSA ? key : new NodeRSA(key, format);
  return (...args) => privateKey.sign(stringify(args), 'base64', 'utf8');
});
//# sourceMappingURL=signer.js.map