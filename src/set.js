// @flow

const { EventEmitter } = require('events');
const DirectedGraphMap = require('directed-graph-map');
const stringify = require('json-stringify-deterministic');
const murmurHash3 = require('murmur-hash').v3;
const generateId = require('./generate-id');

type Options = {
  maxAge?:number,
  bufferPublishing?:number
};

type QueueType = Array<Array<any>>;

/**
 * Class representing an observed-remove set
 *
 * Implements all methods and iterators of the native `Set` object in addition to the following.
 * See: {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set}
 */
class ObservedRemoveSet<T> extends EventEmitter {
  maxAge: number;
  bufferPublishing: number;
  valueMap: Map<string, T>;
  insertions: DirectedGraphMap;
  deletions: Set<string>;
  queue: QueueType;
  publishTimeout: null | TimeoutID;

  /**
   * Create an observed-remove set.
   * @param {Iterable<T>} [entries=[]] Iterable of initial values
   * @param {Object} [options={}]
   * @param {String} [options.maxAge=5000] Max age of insertion/deletion identifiers
   * @param {String} [options.bufferPublishing=20] Interval by which to buffer 'publish' events
   */
  constructor(entries?: Iterable<T>, options?:Options = {}) {
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
    const queue = this.queue;
    this.queue = [];
    this.sync(queue);
  }

  /**
   * Emit a 'publish' event containing a specified queue or all of the set's insertions and deletions.
   * @return {void}
   */
  sync(queue?: QueueType = this.dump()) {
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
   * @return {Array<Array<any>>}
   */
  dump() {
    const queue = [...this.deletions].map((id) => [id]);
    for (const [id, hash] of this.insertions.edges) {
      const value = this.valueMap.get(hash);
      if (typeof value !== 'undefined') {
        queue.push([id, value]);
      }
    }
    return queue;
  }

  /**
   * Process an array of insertion and deletions.
   * @param {Array<Array<any>>} queue - Array of insertions and deletions
   * @return {void}
   */
  process(queue: QueueType, skipFlush?: boolean = false) {
    const queueWithHashes = queue.map(([id:string, value:any]) => {
      if (value && id) {
        const hash = this.hash(value);
        return [id, value, hash];
      }
      return [id];
    });
    const notifications:Map<string, number> = new Map();
    for (const [id:string, value:any, hash:string] of queueWithHashes) { // eslint-disable-line no-unused-vars
      if (!value) {
        continue;
      }
      const insertions = this.insertions.getSources(hash);
      const hasValue = [...insertions].filter((id2) => !this.deletions.has(id2)).length > 0;
      if (!hasValue) {
        const x = notifications.get(hash) || 0;
        notifications.set(hash, x + 1);
      }
    }
    for (const [id:string, value:any, hash:string] of queueWithHashes) {
      if (!value) {
        continue;
      }
      this.valueMap.set(hash, value);
      this.insertions.addEdge(id, hash);
    }
    for (const [id:string, value:any] of queueWithHashes) {
      if (value) {
        continue;
      }
      const hashes = this.insertions.getTargets(id);
      hashes.forEach((hash) => {
        const x = notifications.get(hash) || 0;
        notifications.set(hash, x - 1);
      });
    }
    for (const [id:string, value:any] of queueWithHashes) {
      if (value) {
        continue;
      }
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

  add(value:T, id?:string = generateId()) {
    const message = [id, value];
    this.process([message], true);
    this.queue.push(message);
    this.dequeue();
  }

  activeIds(value:T) {
    const hash = this.hash(value);
    const insertions = this.insertions.getSources(hash);
    return [...insertions].filter((id) => !this.deletions.has(id));
  }

  delete(value:T) {
    const activeIds = this.activeIds(value);
    const queue = activeIds.map((id) => [id]);
    this.process(queue, true);
    this.queue = this.queue.concat(queue);
    this.dequeue();
  }

  clear() {
    for (const value of this) {
      this.delete(value);
    }
  }

  nativeSet():Set<T> {
    const insertions = this.insertions.sources;
    const ids = [...insertions].filter((id) => !this.deletions.has(id));
    ids.sort();
    const values:Map<string, T> = new Map();
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

  entries():Iterable<[T, T]> {
    return this.nativeSet().entries();
  }

  forEach(callback:Function, thisArg?:any) {
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

  has(value:T) {
    return this.activeIds(value).length > 0;
  }

  values():Iterable<T> {
    return this.nativeSet().values();
  }

  hash(value:T) {
    const stringified = stringify(value);
    return murmurHash3.x64.hash128(stringified);
  }

  get size():number {
    const insertions = this.insertions.sources;
    return [...insertions].filter((id) => !this.deletions.has(id)).length;
  }
}

module.exports = ObservedRemoveSet;
