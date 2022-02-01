"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _jsonStringifyDeterministic = _interopRequireDefault(require("json-stringify-deterministic"));

var _nodeRsa = _interopRequireDefault(require("node-rsa"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = (key, format = 'pkcs1-private-pem') => {
  const privateKey = key instanceof _nodeRsa.default ? key : new _nodeRsa.default(key, format);
  return (...args) => privateKey.sign((0, _jsonStringifyDeterministic.default)(args), 'base64', 'utf8');
};

exports.default = _default;
//# sourceMappingURL=signer.js.map