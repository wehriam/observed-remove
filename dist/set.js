//      

const { EventEmitter } = require('events');
const DirectedGraphMap = require('directed-graph-map');
const stringify = require('json-stringify-deterministic');
const murmurHash3 = require('murmur-hash').v3;

                
                 
                          
  

let idCounter = 0;

                                   

/**
 * Class representing a Observed Remove Set
 */
class ObservedRemoveSet    extends EventEmitter {
                 
                           
                           
                               
                         
                   
                                

  constructor(entries              , options          = {}) {
    super();
    this.maxAge = typeof options.maxAge === 'undefined' ? 5000 : options.maxAge;
    this.bufferPublishing = typeof options.bufferPublishing === 'undefined' ? 30 : options.bufferPublishing;
    this.valueMap = new Map();
    this.insertions = new DirectedGraphMap();
    this.deletions = new Set();
    this.queue = [];
    this.publishTimeout = null;
    if (!entries) {
      return;
    }
    for (const value of entries) { // eslint-disable-line no-restricted-syntax
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

  async publish() {
    this.publishTimeout = null;
    const queue = this.queue;
    this.queue = [];
    this.emit('publish', queue);
  }

  flush() {
    const now = Date.now();
    for (const id of this.deletions) { // eslint-disable-line no-restricted-syntax
      const timestamp = parseInt(id.slice(0, 9), 36);
      if (now - timestamp > this.maxAge) {
        this.insertions.removeSource(id);
        this.deletions.delete(id);
      }
    }
  }

  dump() {
    const queue = [...this.deletions].map((id) => [id]);
    for (const [id, hash] of this.insertions.edges) { // eslint-disable-line no-restricted-syntax
      const value = this.valueMap.get(hash);
      if (typeof value !== 'undefined') {
        queue.push([id, value]);
      }
    }
    return queue;
  }

  sync() {
    this.queue = this.queue.concat(this.dump());
    if (this.publishTimeout) {
      clearTimeout(this.publishTimeout);
    }
    this.publish();
  }

  async process(queue           ) {
    for (const [id       , value    ] of queue) { // eslint-disable-line no-restricted-syntax
      if (value && id) {
        const hash = this.hash(value);
        const insertions = this.insertions.getSources(hash);
        const hasValue = [...insertions].filter((id2) => !this.deletions.has(id2)).length > 0;
        this.valueMap.set(hash, value);
        this.insertions.addEdge(id, hash);
        if (!hasValue) {
          this.emit('add', value);
        }
      } else if (id) {
        const hashes = this.insertions.getTargets(id);
        for (const hash of hashes) { // eslint-disable-line no-restricted-syntax
          const localValue = this.valueMap.get(hash);
          const hasValue = typeof localValue !== 'undefined' && !this.deletions.has(id);
          this.deletions.add(id);
          if (hasValue) {
            this.emit('delete', value);
          }
        }
      }
    }
    this.flush();
  }

  add(value  ) {
    const normalizedDateString = Date.now().toString(36).padStart(9, '0');
    const idCounterString = idCounter.toString(36);
    const randomString = Math.round(Number.MAX_SAFE_INTEGER / 2 + Number.MAX_SAFE_INTEGER * Math.random() / 2).toString(36);
    const id = (`${normalizedDateString}${idCounterString}${randomString}`).slice(0, 16);
    idCounter += 1;
    const hash = this.hash(value);
    const insertions = this.insertions.getSources(hash);
    const hasValue = [...insertions].filter((id2) => !this.deletions.has(id2)).length > 0;
    this.valueMap.set(hash, value);
    this.insertions.addEdge(id, hash);
    this.queue.push([id, value]);
    this.dequeue();
    if (!hasValue) {
      this.emit('add', value);
    }
  }

  delete(value  ) {
    const hash = this.hash(value);
    const insertions = this.insertions.getSources(hash);
    const hasValue = [...insertions].filter((id) => !this.deletions.has(id)).length > 0;
    for (const id of insertions) { // eslint-disable-line no-restricted-syntax
      this.deletions.add(id);
      this.queue.push([id]);
    }
    this.dequeue();
    if (hasValue) {
      this.emit('delete', value);
    }
  }

  clear() {
    for (const value of this) { // eslint-disable-line no-restricted-syntax
      this.delete(value);
    }
  }

  entries()                  {
    const insertions = this.insertions.sources;
    const ids = [...insertions].filter((id) => !this.deletions.has(id));
    ids.sort();
    const entries               = [];
    ids.forEach((id) => {
      this.insertions.getTargets(id).forEach((hash) => {
        const value = this.valueMap.get(hash);
        if (typeof value !== 'undefined') {
          entries.push([value, value]);
        }
      });
    });
    // $FlowFixMe: computed property
    return entries[Symbol.iterator]();
  }

  forEach(callback         , thisArg     ) {
    if (thisArg) {
      for (const value of this) { // eslint-disable-line no-restricted-syntax
        callback.bind(thisArg)(value, value, this);
      }
    } else {
      for (const value of this) { // eslint-disable-line no-restricted-syntax
        callback(value, value, this);
      }
    }
  }

  has(value  ) {
    const hash = this.hash(value);
    const insertions = this.insertions.getSources(hash);
    return [...insertions].filter((id) => !this.deletions.has(id)).length > 0;
  }

  values()             {
    const insertions = this.insertions.sources;
    const ids = [...insertions].filter((id) => !this.deletions.has(id));
    ids.sort();
    const values          = [];
    ids.forEach((id) => {
      this.insertions.getTargets(id).forEach((hash) => {
        const value = this.valueMap.get(hash);
        if (typeof value !== 'undefined') {
          values.push(value);
        }
      });
    });
    // $FlowFixMe: computed property
    return values[Symbol.iterator]();
  }

  hash(value  ) {
    const stringified = stringify(value);
    return murmurHash3.x64.hash128(stringified);
  }

  /**
   * Member count
   *
   * @name ObservedRemoveSet#size
   * @type number
   * @readonly
   */
  get size()        {
    const insertions = this.insertions.sources;
    return [...insertions].filter((id) => !this.deletions.has(id)).length;
  }
}

module.exports = ObservedRemoveSet;
