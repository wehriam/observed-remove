//      

const { EventEmitter } = require('events');
const DirectedGraphMap = require('directed-graph-map');
const stringify = require('json-stringify-deterministic');

                
                 
                          
  

                                   

let idCounter = 0;

/**
 * Class representing a Observed Remove Map
 *
 * Implements all methods and iterators of the native `Map` object in addition to the following.
 * See: {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map}
 */
class ObservedRemoveMap       extends EventEmitter {
                 
                           
                           
                         
                               
                         
                   
                                   

  /**
   * Create an observed-remove map.
   * @param {Iterable<K, V>} entries Iterable of initial values
   * @param {Object} options
   * @param {String} [options.maxAge=5000] Max age of insertion/deletion identifiers
   * @param {String} [options.bufferPublishing=20] Interval by which to buffer 'publish' events
   */
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
    for (const [key, value] of entries) {
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

  publish() {
    this.publishTimeout = null;
    const queue = this.queue;
    this.queue = [];
    this.emit('publish', queue);
  }

  flush() {
    const now = Date.now();
    for (const id of this.deletions) {
      const timestamp = parseInt(id.slice(0, 9), 36);
      if (now - timestamp > this.maxAge) {
        this.insertions.removeSource(id);
        this.deletions.delete(id);
      }
    }
  }

  /**
   * Return an array containing all of the map's insertions and deletions.
   * @return {Array<Array<any>>}
   */
  dump() {
    const queue = [...this.deletions].map((id) => [id]);
    for (const [id, key] of this.insertions.edges) {
      const value = this.valueMap.get(id);
      if (typeof value !== 'undefined') {
        queue.push([id, [key, value]]);
      }
    }
    return queue;
  }

  /**
   * Emit a 'publish' event containing all of the map's insertions and deletions.
   * @return {void}
   */
  sync() {
    this.emit('publish', this.dump());
  }

  /**
   * Process an array of insertion and deletions.
   * @param {Array<Array<any>>} queue - Array of insertions and deletions
   * @return {void}
   */
  process(queue           ) {
    let keys = new Set();
    for (const [id       ] of queue) {
      keys = new Set([...keys, ...this.insertions.getTargets(id)]);
    }
    const keyMap = new Map([...keys].map((key) => [key, this.activeId(key)]));
    const newKeys = new Set();
    for (const [id       , tuple               ] of queue) {
      if (tuple && id) {
        const [key, value] = tuple;
        this.valueMap.set(id, value);
        this.insertions.addEdge(id, key);
        newKeys.add(key);
      } else if (id) {
        this.deletions.add(id);
      }
    }
    const newKeyMap = new Map([...newKeys].map((key) => [key, this.activeId(key)]));
    for (const [key, oldId] of keyMap) {
      const newId = newKeyMap.get(key);
      if (!newId) {
        const value = this.valueMap.get(oldId);
        if (value) {
          this.emit('delete', key, value);
        }
      } else if (newId && (oldId !== newId)) {
        const value = this.valueMap.get(newId);
        if (value) {
          this.emit('set', key, value);
        }
      }
    }
    for (const [key, newId] of newKeyMap) {
      if (!keyMap.get(key)) {
        const value = this.valueMap.get(newId);
        if (value) {
          this.emit('set', key, value);
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
    const id = (`${normalizedDateString}${idCounterString}${randomString}`).slice(0, 16);
    idCounter += 1;
    this.valueMap.set(id, value);
    this.insertions.addEdge(id, key);
    this.queue.push([id, [key, value]]);
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
    for (const id of insertions) {
      this.deletions.add(id);
      this.queue.push([id]);
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
    for (const key of this.keys()) {
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
      for (const [key, value] of this.entries()) {
        callback.bind(thisArg)(value, key, this);
      }
    } else {
      for (const [key, value] of this.entries()) {
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
      for (const key of ks) {
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

  get size()        {
    const insertions = this.insertions.sources;
    return [...insertions].filter((id) => !this.deletions.has(id)).length;
  }
}

module.exports = ObservedRemoveMap;
