// @flow

const stringify = require('json-stringify-deterministic');
const ObservedRemoveMap = require('./map');
const getVerifier = require('./verifier');
const { InvalidSignatureError } = require('./signed-error');

type Options = {
  maxAge?:number,
  bufferPublishing?:number,
  key: any,
  format?: string
};

class SignedObservedRemoveMap<K, V> extends ObservedRemoveMap<K, V> {
  constructor(entries?: Iterable<[K, V, string, string]>, options?:Options) {
    super([], options);
    if (!options || !options.key) {
      throw new Error('Missing required options.key parameter');
    }
    this.verify = getVerifier(options.key, options.format);
    this.insertionSignatureMap = new Map();
    this.deletionSignatureMap = new Map();
    if (!entries) {
      return;
    }
    for (const [key, value, id, signature] of entries) {
      this.setSigned(key, value, id, signature);
    }
  }

  insertionSignatureMap: Map<string, string>;
  deletionSignatureMap: Map<string, string>;
  verify: (string, ...Array<any>) => boolean;

  flush() {
    super.flush();
    for (const [id] of this.insertionSignatureMap) {
      if (this.insertions.getTargets(id).size === 0) {
        this.insertionSignatureMap.delete(id);
      }
    }
    for (const [id] of this.deletionSignatureMap) {
      if (!this.deletions.has(id)) {
        this.deletionSignatureMap.delete(id);
      }
    }
  }

  dump():[Array<*>, Array<*>] {
    const [insertQueue, deleteQueue] = super.dump();
    const signedInsertQueue = insertQueue.map(([id, pair]) => [this.insertionSignatureMap.get(id), id, pair]);
    const signedDeleteQueue = deleteQueue.map((id) => [this.deletionSignatureMap.get(id), id]);
    const queue = [signedInsertQueue, signedDeleteQueue];
    return queue;
  }

  process(signedQueue:[Array<*>, Array<*>], skipFlush?: boolean = false) {
    const [signedInsertQueue, signedDeleteQueue] = signedQueue;
    const insertQueue = signedInsertQueue.map(([signature, id, pair]) => {
      const [key, value] = pair;
      if (!this.verify(signature, key, value, id)) {
        throw new InvalidSignatureError(`Signature does not match for key "${key}" with value ${stringify(value)}`);
      }
      this.insertionSignatureMap.set(id, signature);
      return [id, pair];
    });
    const deleteQueue = signedDeleteQueue.map(([signature, id]) => {
      if (!this.verify(signature, id)) {
        throw new InvalidSignatureError(`Signature does not match for id ${stringify(id)}`);
      }
      this.deletionSignatureMap.set(id, signature);
      return id;
    });
    const queue:[Array<[string, [K, V]]>, Array<string>] = [insertQueue, deleteQueue];
    super.process(queue, skipFlush);
  }

  setSigned(key:K, value:V, id:string, signature:string) {
    const message = [signature, id, [key, value]];
    this.process([[message], []], true);
    this.insertQueue.push(message);
    this.dequeue();
  }

  deleteSignedId(id:string, signature:string) {
    const message = [signature, id];
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

module.exports = SignedObservedRemoveMap;
