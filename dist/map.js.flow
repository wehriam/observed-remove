// @flow

const { EventEmitter } = require('events');
const generateId = require('./generate-id');

type Options = {
  maxAge?:number,
  bufferPublishing?:number
};

/**
 * Class representing a Observed Remove Map
 *
 * Implements all methods and iterators of the native `Map` object in addition to the following.
 * See: {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map}
 */
class ObservedRemoveMap<K, V> extends EventEmitter {
  maxAge: number;
  bufferPublishing: number;
  pairs: Map<K, [string, V]>;
  deletions: Map<string, K>;
  deleteQueue: Array<*>;
  insertQueue: Array<*>;
  publishTimeout: null | TimeoutID;

  constructor(entries?: Iterable<[K, V]>, options?:Options = {}) {
    super();
    this.maxAge = typeof options.maxAge === 'undefined' ? 5000 : options.maxAge;
    this.bufferPublishing = typeof options.bufferPublishing === 'undefined' ? 30 : options.bufferPublishing;
    this.publishTimeout = null;
    this.pairs = new Map();
    this.deletions = new Map();
    this.insertQueue = [];
    this.deleteQueue = [];
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
    const insertQueue = this.insertQueue;
    const deleteQueue = this.deleteQueue;
    this.insertQueue = [];
    this.deleteQueue = [];
    this.sync([insertQueue, deleteQueue]);
  }

  flush() {
    const now = Date.now();
    for (const [id] of this.deletions) {
      const timestamp = parseInt(id.slice(0, 9), 36);
      if (now - timestamp >= this.maxAge) {
        this.deletions.delete(id);
      }
    }
  }

  /**
   * Emit a 'publish' event containing a specified queue or all of the set's insertions and deletions.
   * @param {Array<Array<any>>} queue - Array of insertions and deletions
   * @return {void}
   */
  sync(queue?: [Array<*>, Array<*>] = this.dump()) {
    this.emit('publish', queue);
  }

  /**
   * Return an array containing all of the map's insertions and deletions.
   * @return {[Array<*>, Array<*>]>}
   */
  dump():[Array<*>, Array<*>] {
    return [[...this.pairs], [...this.deletions]];
  }

  process(queue:[Array<*>, Array<*>], skipFlush?: boolean = false) {
    const [insertions, deletions] = queue;
    for (const [id, key] of deletions) {
      const pair = this.pairs.get(key);
      if (pair && pair[0] === id) {
        this.pairs.delete(key);
        this.emit('delete', key, pair[1]);
      }
      this.deletions.set(id, key);
    }
    for (const [key, [id, value]] of insertions) {
      if (this.deletions.has(id)) {
        continue;
      }
      const pair = this.pairs.get(key);
      if (!pair || (pair && pair[0] < id)) {
        this.pairs.set(key, [id, value]);
        this.emit('set', key, value);
      }
    }
    if (!skipFlush) {
      this.flush();
    }
  }

  set(key:K, value:V, id?: string = generateId()) {
    const pair = this.pairs.get(key);
    const insertMessage = [key, [id, value]];
    if (pair) {
      const deleteMessage = [pair[0], key];
      this.process([[insertMessage], [deleteMessage]], true);
      this.deleteQueue.push(deleteMessage);
    } else {
      this.process([[insertMessage], []], true);
    }
    this.insertQueue.push(insertMessage);
    this.dequeue();
    return this;
  }

  get(key:K): V | void { // eslint-disable-line consistent-return
    const pair = this.pairs.get(key);
    if (pair) {
      return pair[1];
    }
  }

  delete(key:K):void {
    const pair = this.pairs.get(key);
    if (pair) {
      const message = [pair[0], key];
      this.process([[], [message]], true);
      this.deleteQueue.push(message);
      this.dequeue();
    }
  }

  clear(): void {
    for (const key of this.keys()) {
      this.delete(key);
    }
  }

  nativeMap():Map<K, V> {
    const entries:Map<K, V> = new Map();
    for (const [key, pair] of this.pairs) {
      entries.set(key, pair[1]);
    }
    return entries;
  }

  entries():Iterator<[K, V]> {
    return this.nativeMap().entries();
  }

  forEach(callback:Function, thisArg?:any):void {
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

  has(key:K): boolean {
    return !!this.pairs.get(key);
  }

  keys():Iterator<K> {
    return this.pairs.keys();
  }

  values():Iterator<V> {
    return this.nativeMap().values();
  }

  get size():number {
    return this.pairs.size;
  }
}

module.exports = ObservedRemoveMap;
