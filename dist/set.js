//      

const { EventEmitter } = require('events');
const DirectedGraphMap = require('directed-graph-map');
const stringify = require('json-stringify-deterministic');
const murmurHash3 = require('murmur-hash').v3;
const generateId = require('./generate-id');

                
                 
                          
  

/**
 * Class representing an observed-remove set
 *
 * Implements all methods and iterators of the native `Set` object in addition to the following.
 * See: {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set}
 */
class ObservedRemoveSet    extends EventEmitter {
                 
                           
                           
                               
                         
                        
                        
                                   

  /**
   * Create an observed-remove set.
   * @param {Iterable<T>} [entries=[]] Iterable of initial values
   * @param {Object} [options={}]
   * @param {String} [options.maxAge=5000] Max age of insertion/deletion identifiers
   * @param {String} [options.bufferPublishing=20] Interval by which to buffer 'publish' events
   */
  constructor(entries              , options          = {}) {
    super();
    this.maxAge = typeof options.maxAge === 'undefined' ? 5000 : options.maxAge;
    this.bufferPublishing = typeof options.bufferPublishing === 'undefined' ? 30 : options.bufferPublishing;
    this.valueMap = new Map();
    this.insertions = new DirectedGraphMap();
    this.deletions = new Set();
    this.deleteQueue = [];
    this.insertQueue = [];
    this.publishTimeout = null;
    if (!entries) {
      return;
    }
    for (const value of entries) {
      this.add(value);
    }
  }

  /* :: @@iterator(): Iterator<T> { return ({}: any); } */
  // $FlowFixMe: computed property
  [Symbol.iterator]() {
    return this.values();
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
    this.sync([insertQueue, deleteQueue]);
  }

  /**
   * Emit a 'publish' event containing a specified queue or all of the set's insertions and deletions.
   * @param {Array<Array<any>>} queue - Array of insertions and deletions
   * @return {void}
   */
  sync(queue                        = this.dump()) {
    this.emit('publish', queue);
  }

  flush() {
    const now = Date.now();
    for (const id of this.deletions) {
      const timestamp = parseInt(id.slice(0, 9), 36);
      if (now - timestamp > this.maxAge) {
        const hashes = this.insertions.getTargets(id);
        this.insertions.removeSource(id);
        this.deletions.delete(id);
        for (const hash of hashes) {
          if (this.insertions.getSources(hash).size === 0) {
            this.valueMap.delete(hash);
          }
        }
      }
    }
    for (const hash of this.insertions.targets) {
      const ids = Array.from(this.insertions.getSources(hash));
      ids.sort();
      for (let i = 0; i < ids.length - 1; i += 1) {
        const id = ids[i];
        this.insertions.removeEdge(id, hash);
        this.deletions.delete(id);
      }
    }
  }

  /**
   * Return an array containing all of the set's insertions and deletions.
   * @return {[Array<*>, Array<*>]>}
   */
  dump()                      {
    const deleteQueue = [...this.deletions];
    const insertQueue = [];
    for (const [id, hash] of this.insertions.edges) {
      const value = this.valueMap.get(hash);
      if (typeof value !== 'undefined') {
        insertQueue.push([id, value]);
      }
    }
    const queue = [insertQueue, deleteQueue];
    return queue;
  }

  /**
   * Process an array of insertion and deletions.
   * @param {Array<Array<any>>} queue - Array of insertions and deletions
   * @return {void}
   */
  process(queue                     , skipFlush           = false) {
    const [insertQueue, deleteQueue] = queue;
    const insertQueueWithHashes = insertQueue.map(([id, value]) => {
      const hash = this.hash(value);
      return [id, value, hash];
    });
    const notifications                     = new Map();
    for (const [id, value, hash] of insertQueueWithHashes) { // eslint-disable-line no-unused-vars
      const insertions = this.insertions.getSources(hash);
      const hasValue = [...insertions].filter((id2) => !this.deletions.has(id2)).length > 0;
      if (!hasValue) {
        const x = notifications.get(hash) || 0;
        notifications.set(hash, x + 1);
      }
    }
    for (const [id, value, hash] of insertQueueWithHashes) {
      if (!value) {
        continue;
      }
      this.valueMap.set(hash, value);
      this.insertions.addEdge(id, hash);
    }
    for (const id of deleteQueue) {
      const hashes = this.insertions.getTargets(id);
      hashes.forEach((hash) => {
        const x = notifications.get(hash) || 0;
        notifications.set(hash, x - 1);
      });
    }
    for (const id of deleteQueue) {
      this.deletions.add(id);
    }
    for (const [hash, x] of notifications) {
      if (x > 0) {
        const value = this.valueMap.get(hash);
        if (value) {
          this.emit('add', value);
        }
      } else if (x < 0) {
        const value = this.valueMap.get(hash);
        if (value) {
          this.emit('delete', value);
        }
      }
    }
    if (!skipFlush) {
      this.flush();
    }
  }

  add(value  , id         = generateId()) {
    const message = [id, value];
    this.process([[message], []], true);
    this.insertQueue.push(message);
    this.dequeue();
    return this;
  }

  activeIds(value  ) {
    const hash = this.hash(value);
    const insertions = this.insertions.getSources(hash);
    return [...insertions].filter((id) => !this.deletions.has(id));
  }

  delete(value  ) {
    const activeIds = this.activeIds(value);
    this.process([[], activeIds], true);
    this.deleteQueue = this.deleteQueue.concat(activeIds);
    this.dequeue();
  }

  clear() {
    for (const value of this) {
      this.delete(value);
    }
  }

  nativeSet()        {
    const insertions = this.insertions.sources;
    const ids = [...insertions].filter((id) => !this.deletions.has(id));
    ids.sort();
    const values                = new Map();
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      this.insertions.getTargets(id).forEach((hash) => {
        const value = this.valueMap.get(hash);
        if (value) {
          values.set(hash, value);
        }
      });
    }
    return new Set(values.values());
  }

  entries()                  {
    return this.nativeSet().entries();
  }

  forEach(callback         , thisArg     ) {
    if (thisArg) {
      for (const value of this) {
        callback.bind(thisArg)(value, value, this);
      }
    } else {
      for (const value of this) {
        callback(value, value, this);
      }
    }
  }

  has(value  )         {
    return this.activeIds(value).length > 0;
  }

  keys()             {
    return this.nativeSet().values();
  }

  values()             {
    return this.nativeSet().values();
  }

  hash(value  )        {
    const stringified = stringify(value);
    return murmurHash3.x64.hash128(stringified);
  }

  get size()        {
    const insertions = this.insertions.sources;
    return [...insertions].filter((id) => !this.deletions.has(id)).length;
  }
}

module.exports = ObservedRemoveSet;
