//      

const { EventEmitter } = require('events');
const DirectedGraphMap = require('directed-graph-map');
const stringify = require('json-stringify-deterministic');
// const murmurHash3 = require('murmur-hash').v3;
const { gzip, gunzip } = require('./lib/gzip');

                
                 
                          
  

let idCounter = 0;

/**
 * Class representing a Observed Remove Set
 */
class ObservedRemoveMap       extends EventEmitter {
                 
                           
                           
                         
                               
                         
                                          
                                

  constructor(entries                   , options          = {}) {
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
    for (const [key, value] of entries) { // eslint-disable-line no-restricted-syntax
      this.set(key, value);
    }
  }

  /* :: @@iterator(): Iterator<[K, V]> { return ({}: any); } */
  // $FlowFixMe: computed property
  [Symbol.iterator]() {
    return this.entries();
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
    this.emit('publish', await gzip(JSON.stringify(queue)));
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


  sync() {
    this.queue = this.queue.concat([...this.deletions]);
    for (const [id, key] of this.insertions.edges) { // eslint-disable-line no-restricted-syntax
      const value = this.valueMap.get(id);
      if (typeof value !== 'undefined') {
        this.queue.push([id, JSON.stringify([key, value])]);
      }
    }
    if (this.publishTimeout) {
      clearTimeout(this.publishTimeout);
    }
    this.publish();
  }


  async process(buffer       ) {
    const queue = JSON.parse(await gunzip(buffer));
    for (const x of queue) { // eslint-disable-line no-restricted-syntax
      if (typeof x === 'string') {
        const id        = x;
        const keys = this.insertions.getTargets(id);
        for (const key of keys) { // eslint-disable-line no-restricted-syntax
          const activeId = this.activeId(key);
          this.deletions.add(id);
          const newActiveId = this.activeId(key);
          if (activeId && !newActiveId) {
            const value = this.valueMap.get(activeId);
            if (value) {
              this.emit('delete', key, value);
            }
          }
        }
      } else if (x instanceof Array) {
        const [id       , stringified       ] = x;
        const [key, value] = JSON.parse(stringified);
        const activeValue = this.get(key);
        this.valueMap.set(id, value);
        this.insertions.addEdge(id, key);
        const newValue = this.get(key);
        if (!activeValue || (newValue && stringify(activeValue) !== stringify(newValue))) {
          this.emit('set', newValue);
        }
      }
    }
    this.flush();
  }

  set(key  , value  ) {
    const activeValue = this.get(key);
    const normalizedDateString = Date.now().toString(36).padStart(9, '0');
    const idCounterString = idCounter.toString(36);
    const randomString = Math.round(Number.MAX_SAFE_INTEGER / 2 + Number.MAX_SAFE_INTEGER * Math.random() / 2).toString(36);
    const id = (`${normalizedDateString}${idCounterString}${randomString}`).slice(0, 20);
    idCounter += 1;
    this.valueMap.set(id, value);
    this.insertions.addEdge(id, key);
    this.queue.push([id, JSON.stringify([key, value])]);
    this.dequeue();
    if (!activeValue || (activeValue && stringify(activeValue) !== stringify(value))) {
      this.emit('set', key, value);
    }
  }

  get(key  ) { // eslint-disable-line consistent-return
    const insertions = this.insertions.getSources(key);
    const activeValues = [...insertions].filter((id) => !this.deletions.has(id));
    activeValues.sort();
    const activeId = activeValues[0];
    if (activeId) {
      return this.valueMap.get(activeId);
    }
  }

  delete(key  ) {
    const insertions = this.insertions.getSources(key);
    const activeValues = [...insertions].filter((id) => !this.deletions.has(id));
    activeValues.sort();
    let value;
    const activeId = activeValues[0];
    if (activeId) {
      value = this.valueMap.get(activeId);
    }
    for (const id of insertions) { // eslint-disable-line no-restricted-syntax
      this.deletions.add(id);
      this.queue.push(id);
    }
    this.dequeue();
    if (value) {
      this.emit('delete', key, value);
    }
  }

  activeId(key  ) {
    const insertions = this.insertions.getSources(key);
    const activeValues = [...insertions].filter((id) => !this.deletions.has(id));
    activeValues.sort();
    return activeValues[0];
  }

  clear() {
    for (const [key] of this.entries()) { // eslint-disable-line no-restricted-syntax
      this.delete(key);
    }
  }

  entries()                  {
    const insertions = this.insertions.sources;
    const ids = [...insertions].filter((id) => !this.deletions.has(id));
    ids.sort();
    const entries               = [];
    ids.forEach((id) => {
      const value = this.valueMap.get(id);
      if (typeof value !== 'undefined') {
        this.insertions.getTargets(id).forEach((key) => {
          entries.push([key, value]);
        });
      }
    });
    // $FlowFixMe: computed property
    return entries[Symbol.iterator]();
  }

  forEach(callback         , thisArg     ) {
    if (thisArg) {
      for (const [key, value] of this.entries()) { // eslint-disable-line no-restricted-syntax
        callback.bind(thisArg)(value, key, this);
      }
    } else {
      for (const [key, value] of this.entries()) { // eslint-disable-line no-restricted-syntax
        callback(value, key, this);
      }
    }
  }

  has(key  ) {
    const insertions = this.insertions.getSources(key);
    return [...insertions].filter((id) => !this.deletions.has(id)).length > 0;
  }

  keys()             {
    const insertions = this.insertions.sources;
    const ids = [...insertions].filter((id) => !this.deletions.has(id));
    ids.sort();
    const keys          = [];
    ids.forEach((id) => {
      const ks = this.insertions.getTargets(id);
      for (const key of ks) { // eslint-disable-line no-restricted-syntax
        keys.push(key);
      }
    });
    // $FlowFixMe: computed property
    return keys[Symbol.iterator]();
  }

  values()             {
    const insertions = this.insertions.sources;
    const ids = [...insertions].filter((id) => !this.deletions.has(id));
    ids.sort();
    const values          = [];
    ids.forEach((id) => {
      const value = this.valueMap.get(id);
      if (typeof value !== 'undefined') {
        values.push(value);
      }
    });
    // $FlowFixMe: computed property
    return values[Symbol.iterator]();
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

module.exports = ObservedRemoveMap;
