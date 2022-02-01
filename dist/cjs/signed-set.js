"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _set = _interopRequireDefault(require("./set"));

var _verifier = _interopRequireDefault(require("./verifier"));

var _signedError = require("./signed-error");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class SignedObservedRemoveSet extends _set.default {
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

    for (const [value, id, signature] of entries) {
      this.addSigned(value, id, signature);
    }
  }

  /**
   * Return an array containing all of the set's insertions and deletions.
   * @return {Array<Array<any>>}
   */
  dump() {
    const [insertQueue, deleteQueue] = super.dump();
    const signedInsertQueue = insertQueue.map(([hash, [id, value]]) => {
      const signature = this.insertionSignatureMap.get(id);

      if (!signature) {
        throw new Error(`Missing signature for insertion with id "${id}" and value "${JSON.stringify(value)}"`);
      }

      return [signature, id, hash, value];
    });
    const signedDeleteQueue = deleteQueue.map(([id, hash]) => {
      const signature = this.deletionSignatureMap.get(id);

      if (!signature) {
        throw new Error(`Missing signature for deletion with id "${id}"`);
      }

      return [signature, id, hash];
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
    const insertQueue = signedInsertQueue.map(([signature, id, hash, value]) => {
      if (!this.verify(signature, value, id)) {
        throw new _signedError.InvalidSignatureError(`Signature does not match for value ${JSON.stringify(value)}`);
      }

      this.insertionSignatureMap.set(id, signature);
      return [hash, [id, value]];
    });
    const deleteQueue = signedDeleteQueue.map(([signature, id, hash]) => {
      if (!this.verify(signature, id)) {
        throw new _signedError.InvalidSignatureError(`Signature does not match for id ${JSON.stringify(id)}`);
      }

      this.deletionSignatureMap.set(id, signature);
      return [id, hash];
    });
    const queue = [insertQueue, deleteQueue];
    super.process(queue, skipFlush);

    for (const [signature, id, hash] of signedInsertQueue) {
      // eslint-disable-line no-unused-vars
      const pair = this.pairs.get(hash);

      if (!pair || pair[0] !== id) {
        this.insertionSignatureMap.delete(id);
      }
    }
  }

  addSigned(value, id, signature) {
    const hash = this.hash(value);
    const message = [signature, id, hash, value];
    this.process([[message], []], true);
    this.insertQueue.push(message);
    this.dequeue();
    return this;
  }

  deleteSignedId(id, signature) {
    for (const [hash, [pairId]] of this.pairs) {
      if (pairId === id) {
        const message = [signature, id, hash];
        this.process([[], [message]], true);
        this.deleteQueue.push(message);
        this.dequeue();
        return;
      }
    }
  }

  clear() {
    throw new Error('Unsupported method clear()');
  }

  add() {
    throw new Error('Unsupported method add(), use addSigned()');
  }

  delete() {
    throw new Error('Unsupported method delete(), use deleteSignedId()');
  }

}

exports.default = SignedObservedRemoveSet;
//# sourceMappingURL=signed-set.js.map