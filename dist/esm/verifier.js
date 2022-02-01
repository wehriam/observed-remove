import stringify from 'json-stringify-deterministic';
import NodeRSA from 'node-rsa';
export default ((key, format = 'pkcs1-public-pem') => {
  const publicKey = key instanceof NodeRSA ? key : new NodeRSA(key, format);
  return (signature, ...args) => publicKey.verify(stringify(args), signature, 'utf8', 'base64');
});
//# sourceMappingURL=verifier.js.map