"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _map = _interopRequireDefault(require("./map"));

var _verifier = _interopRequireDefault(require("./verifier"));

var _signedError = require("./signed-error");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class SignedObservedRemoveMap extends _map.default {
  constructor(entries, options) {
    super([], options);

    if (!options || !options.key) {
      throw new Error('Missing required options.key parameter');
    }

    this.verify = (0, _verifier.default)(options.key, options.format);
    this.insertionSignatureMap = new Map();
    this.deletionSignatureMap = new Map();

    if (!entries) {
      return;
    }

    for (const [key, value, id, signature] of entries) {
      this.setSigned(key, value, id, signature);
    }
  }

  dump() {
    const [insertQueue, deleteQueue] = super.dump();
    const signedInsertQueue = insertQueue.map(([key, [id, value]]) => {
      const signature = this.insertionSignatureMap.get(id);

      if (!signature) {
        throw new Error(`Missing signature for insertion key "${JSON.stringify(key)}" with id "${id}" and value "${JSON.stringify(value)}"`);
      }

      return [signature, id, key, value];
    });
    const signedDeleteQueue = deleteQueue.map(([id, key]) => {
      const signature = this.deletionSignatureMap.get(id);

      if (!signature) {
        throw new Error(`Missing signature for deletion key "${JSON.stringify(key)}" with id "${id}"`);
      }

      return [signature, id, key];
    });
    const queue = [signedInsertQueue, signedDeleteQueue];
    return queue;
  }

  flush() {
    const now = Date.now();

    for (const [id] of this.deletions) {
      const timestamp = parseInt(id.slice(0, 9), 36);

      if (now - timestamp >= this.maxAge) {
        this.deletions.delete(id);
        this.deletionSignatureMap.delete(id);
      }
    }
  }

  process(signedQueue, skipFlush = false) {
    const [signedInsertQueue, signedDeleteQueue] = signedQueue;
    const insertQueue = signedInsertQueue.map(([signature, id, key, value]) => {
      if (!this.verify(signature, key, value, id)) {
        throw new _signedError.InvalidSignatureError(`Signature does not match for key "${key}" with value ${JSON.stringify(value)}`);
      }

      this.insertionSignatureMap.set(id, signature);
      return [key, [id, value]];
    });
    const deleteQueue = signedDeleteQueue.map(([signature, id, key]) => {
      if (!this.verify(signature, key, id)) {
        throw new _signedError.InvalidSignatureError(`Signature does not match for id ${JSON.stringify(id)}`);
      }

      this.deletionSignatureMap.set(id, signature);
      return [id, key];
    });
    const queue = [insertQueue, deleteQueue];
    super.process(queue, skipFlush);

    for (const [signature, id, key] of signedInsertQueue) {
      // eslint-disable-line no-unused-vars
      const pair = this.pairs.get(key);

      if (!pair || pair[0] !== id) {
        this.insertionSignatureMap.delete(id);
      }
    }
  }

  setSigned(key, value, id, signature) {
    const message = [signature, id, key, value];
    this.process([[message], []], true);
    this.insertQueue.push(message);
    this.dequeue();
    return this;
  }

  deleteSigned(key, id, signature) {
    const message = [signature, id, key];
    this.process([[], [message]], true);
    this.deleteQueue.push(message);
    this.dequeue();
  }

  clear() {
    throw new Error('Unsupported method clear()');
  }

  set() {
    throw new Error('Unsupported method set(), use setSigned()');
  }

  delete() {
    throw new Error('Unsupported method delete(), use deleteSignedId()');
  }

}

exports.default = SignedObservedRemoveMap;
//# sourceMappingURL=signed-map.js.map