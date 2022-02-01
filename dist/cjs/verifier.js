"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _jsonStringifyDeterministic = _interopRequireDefault(require("json-stringify-deterministic"));

var _nodeRsa = _interopRequireDefault(require("node-rsa"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = (key, format = 'pkcs1-public-pem') => {
  const publicKey = key instanceof _nodeRsa.default ? key : new _nodeRsa.default(key, format);
  return (signature, ...args) => publicKey.verify((0, _jsonStringifyDeterministic.default)(args), signature, 'utf8', 'base64');
};

exports.default = _default;
//# sourceMappingURL=verifier.js.map