//      

const { EventEmitter } = require('events');
const isEqual = require('lodash.isequal');
const { InvalidSignatureError } = require('./signed-error');
const getVerifier = require('./verifier');
const hasher = require('./hasher');

                
                 
                           
           
                 
  

/**
 * Class representing a Signed Observed Remove Map
 */
class SignedObservedRemoveMap       extends EventEmitter {
                         
                                   
                                                      
                                                      
                                                  
                                                            
                                           
                        
                                                     

  constructor(entries                                , options        ) {
    super();
    if (!options || !options.key) {
      throw new Error('Missing required options.key parameter');
    }
    this.maxAge = typeof options.maxAge === 'undefined' ? 5000 : options.maxAge;
    this.bufferPublishing = typeof options.bufferPublishing === 'undefined' ? 0 : options.bufferPublishing;
    this.publishTimeout = null;
    this.triples = new Map();
    this.deletions = new Map();
    this.insertQueue = [];
    this.deleteQueue = [];
    this.verify = getVerifier(options.key, options.format);
    this.clock = 0;
    if (!entries) {
      return;
    }
    for (const [key, value, id, signature] of entries) {
      this.setSigned(key, value, id, signature);
    }
    this.clock = Math.max(0, ...entries.map((x) => x[2]));
  }

  /* :: @@iterator()                   { return ({}     ); } */
  // $FlowFixMe: computed property
  [Symbol.iterator]() {
    return this.entries();
  }

  incrementClock() {
    this.clock += 1;
  }

  dequeue() {
    if (this.publishTimeout) {
      return;
    }
    if (this.bufferPublishing > 0) {
      this.publishTimeout = setTimeout(() => this.publish(), this.bufferPublishing);
    } else {
      this.publish();
    }
  }

  publish() {
    this.publishTimeout = null;
    const insertQueue = this.insertQueue;
    const deleteQueue = this.deleteQueue;
    this.insertQueue = [];
    this.deleteQueue = [];
    this.sync([insertQueue, deleteQueue, this.clock]);
  }

  flush() {
    const expiration = Date.now() - this.maxAge;
    for (const [id, [, , wallclock]] of this.deletions) {
      if (wallclock < expiration) {
        this.deletions.delete(id);
      }
    }
  }

  /**
   * Emit a 'publish' event containing a specified queue or all of the set's insertions and deletions.
   * @param {Array<Array<any>>} queue - Array of insertions and deletions
   * @return {void}
   */
  sync(queue                                                                              = this.dump()) {
    this.emit('publish', queue);
  }

  /**
   * Return an array containing all of the map's insertions and deletions.
   * @return {[Array<[K, number, V | void, string]>, Array<[number, K, string]>, number]}
   */
  dump()                                                                            {
    const insertions = [];
    for (const [key, [id, value, signature]] of this.triples) {
      insertions.push([key, id, value, signature]);
    }
    const deletions = [];
    for (const [id, [key, signature]] of this.deletions) {
      deletions.push([id, key, signature]);
    }
    return [insertions, deletions, this.clock];
  }

  process([insertions, deletions, remoteClock]                                                                           ) {
    this.clock = Math.max(this.clock, remoteClock);
    this.incrementClock();
    this._process(insertions, deletions, false); // eslint-disable-line no-underscore-dangle
  }

  _process(insertions                                      , deletions                            , skipFlush         ) {
    if (typeof deletions !== 'undefined') {
      for (const [id, key, signature] of deletions) {
        if (!this.verify(signature, key, id)) {
          throw new InvalidSignatureError('Signature does not match for deletion');
        }
        this.deletions.set(id, [key, signature, Date.now()]);
      }
    }
    if (typeof insertions !== 'undefined') {
      for (const [key, id, value, signature] of insertions) {
        if (this.deletions.has(id)) {
          continue;
        }
        if (!this.verify(signature, key, value, id)) {
          throw new InvalidSignatureError('Signature does not match for insertion');
        }
        const triple = this.triples.get(key);
        if (!triple) {
          this.triples.set(key, [id, value, signature]);
          this.emit('set', key, value, triple && triple[1] ? triple[1] : undefined);
        } else if (triple[0] < id) {
          this.triples.set(key, [id, value, signature]);
          if (!isEqual(value, triple[1])) {
            this.emit('set', key, value, triple && triple[1] ? triple[1] : undefined);
          }
        } else if (triple[0] === id) {
          if (isEqual(value, triple[1])) {
            this.emit('affirm', key, value, triple ? triple[1] : undefined);
          } else if (hasher(value) > hasher(triple[1])) {
            this.triples.set(key, [id, value, signature]);
            this.emit('set', key, value, triple && triple[1] ? triple[1] : undefined);
          }
        }
      }
    }
    if (typeof deletions !== 'undefined') {
      for (const [id, key] of deletions) {
        const triple = this.triples.get(key);
        if (triple && triple[0] === id) {
          this.triples.delete(key);
          this.emit('delete', key, triple[1]);
        }
      }
    }
    if (!skipFlush) {
      this.flush();
    }
  }

  generateId() {
    this.incrementClock();
    return this.clock;
  }

  setSigned(key  , value  , id       , signature       ) {
    const insertMessage = typeof value === 'undefined' ? [key, id, undefined, signature] : [key, id, value, signature];
    this._process([insertMessage], undefined, true); // eslint-disable-line no-underscore-dangle
    this.insertQueue.push(insertMessage);
    this.dequeue();
    return this;
  }

  get(key  )           { // eslint-disable-line consistent-return
    const triple = this.triples.get(key);
    if (triple) {
      return triple[1];
    }
  }

  deleteSigned(key  , id       , signature       ) {
    const deleteMessage = [id, key, signature];
    this._process(undefined, [deleteMessage], true); // eslint-disable-line no-underscore-dangle
    this.deleteQueue.push(deleteMessage);
    this.dequeue();
  }

  * entries()                         {
    for (const [key, [id, value]] of this.triples) { // eslint-disable-line no-unused-vars
      yield [key, value];
    }
  }

  forEach(callback         , thisArg     )      {
    if (thisArg) {
      for (const [key, value] of this.entries()) {
        callback.bind(thisArg)(value, key, this);
      }
    } else {
      for (const [key, value] of this.entries()) {
        callback(value, key, this);
      }
    }
  }

  has(key  )          {
    return !!this.triples.get(key);
  }

  keys()             {
    return this.triples.keys();
  }

  * values()                    {
    for (const [id, value] of this.triples.values()) { // eslint-disable-line no-unused-vars
      yield value;
    }
  }

  get size()        {
    return this.triples.size;
  }

  clear() {
    throw new Error('Unsupported method clear()');
  }

  set() {
    throw new Error('Unsupported method set(), use setSigned()');
  }

  delete() {
    throw new Error('Unsupported method delete(), use deleteSigned()');
  }
}

module.exports = SignedObservedRemoveMap;
