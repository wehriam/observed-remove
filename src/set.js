// @flow

const { EventEmitter } = require('events');
const DirectedGraphMap = require('directed-graph-map');
const stringify = require('json-stringify-deterministic');
const murmurHash3 = require('murmur-hash').v3;

type Options = {
  maxAge?:number,
  bufferPublishing?:number
};

let idCounter = 0;

type QueueType = Array<Array<any>>;

/**
 * Class representing an observed-remove set
 */
class ObservedRemoveSet<T> extends EventEmitter {
  maxAge: number;
  bufferPublishing: number;
  valueMap: Map<string, T>;
  insertions: DirectedGraphMap;
  deletions: Set<string>;
  queue: QueueType;
  publishTimeout: null | number;
  processing: boolean;

  /**
   * Create a observed-remove set.
   * @param {Iterable<T>} entries Iterable of initial values
   * @param {Object} options
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
    this.processing = false;
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
   * Emit a 'publish' event containing all of the set's insertions and deletions.
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
  process(queue: QueueType) {
    const queueWithHashes = rawQueue.map(([id:string, value:any]) => {
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
    this.flush();
  }

  add(value:T) {
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

  delete(value:T) {
    const hash = this.hash(value);
    const insertions = this.insertions.getSources(hash);
    const hasValue = [...insertions].filter((id) => !this.deletions.has(id)).length > 0;
    for (const id of insertions) {
      this.deletions.add(id);
      this.queue.push([id]);
    }
    this.dequeue();
    if (hasValue) {
      this.emit('delete', value);
    }
  }

  clear() {
    for (const value of this) {
      this.delete(value);
    }
  }

  entries():Iterable<[T, T]> {
    const insertions = this.insertions.sources;
    const ids = [...insertions].filter((id) => !this.deletions.has(id));
    ids.sort();
    const entries:Array<[T, T]> = [];
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
    const hash = this.hash(value);
    const insertions = this.insertions.getSources(hash);
    return [...insertions].filter((id) => !this.deletions.has(id)).length > 0;
  }

  values():Iterable<T> {
    const insertions = this.insertions.sources;
    const ids = [...insertions].filter((id) => !this.deletions.has(id));
    ids.sort();
    const values:Array<T> = [];
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
