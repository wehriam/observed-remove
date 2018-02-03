//      

const stringify = require('json-stringify-deterministic');
const ObservedRemoveMap = require('./map');
const getVerifier = require('./verifier');
const { InvalidSignatureError } = require('./signed-error');

                                   

                
                 
                           
           
                 
  

class SignedObservedRemoveMap       extends ObservedRemoveMap       {
  constructor(entries                                   , options         ) {
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

  dump() {
    const queue = super.dump();
    return queue.map(([id, pair]) => {
      if (pair) {
        return [this.insertionSignatureMap.get(id), id, pair];
      }
      return [this.deletionSignatureMap.get(id), id];
    });
  }

  process(signedQueue           , skipFlush           = false) {
    const queue = signedQueue.map((item) => {
      const [signature, id, pair] = item;
      if (pair) {
        const [key, value] = pair;
        if (!this.verify(signature, key, value, id)) {
          throw new InvalidSignatureError(`Signature does not match for value ${stringify(value)}`);
        }
        this.insertionSignatureMap.set(id, signature);
        return [id, pair];
      }
      if (!this.verify(signature, id)) {
        throw new InvalidSignatureError(`Signature does not match for id ${stringify(id)}`);
      }
      this.deletionSignatureMap.set(id, signature);
      return [id];
    });
    super.process(queue, skipFlush);
  }

  setSigned(key  , value  , id       , signature       ) {
    const message = [signature, id, [key, value]];
    this.process([message], true);
    this.queue.push(message);
    this.dequeue();
  }

  deleteSignedId(id       , signature       ) {
    const message = [signature, id];
    this.process([message], true);
    this.queue.push(message);
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
