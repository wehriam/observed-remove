// @flow

const { EventEmitter } = require('events');
const generateId = require('./generate-id');
const hasher = require('./hasher');

type Options = {
  maxAge?:number,
  bufferPublishing?:number
};

/**
 * Class representing an observed-remove set
 *
 * Implements all methods and iterators of the native `Set` object in addition to the following.
 * See: {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set}
 */
class ObservedRemoveSet<T> extends EventEmitter {
  declare maxAge: number;
  declare bufferPublishing: number;
  declare pairs: Map<string, [string, T]>;
  declare deletions: Map<string, string>;
  declare deleteQueue: Array<*>;
  declare insertQueue: Array<*>;
  declare publishTimeout: null | TimeoutID;

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
    this.publishTimeout = null;
    this.pairs = new Map();
    this.deletions = new Map();
    this.insertQueue = [];
    this.deleteQueue = [];
    if (!entries) {
      return;
    }
    for (const value of entries) {
      this.add(value);
    }
  }

  /* :: @@iterator(): Iterator<T> { return ({}: any); } */
  // $FlowFixMe: computed property
  * [Symbol.iterator]() {
    for (const pair of this.pairs.values()) {
      yield pair[1];
    }
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
  sync(queue?: [Array<*>, Array<*>] = this.dump()) {
    this.emit('publish', queue);
  }

  flush() {
    const maxAgeString = (Date.now() - this.maxAge).toString(36).padStart(9, '0');
    for (const [id] of this.deletions) {
      if (id < maxAgeString) {
        this.deletions.delete(id);
      }
    }
  }

  /**
   * Return an array containing all of the set's insertions and deletions.
   * @return {[Array<*>, Array<*>]>}
   */
  dump():[Array<*>, Array<*>] {
    return [[...this.pairs], [...this.deletions]];
  }

  /**
   * Process an array of insertion and deletions.
   * @param {Array<Array<any>>} queue - Array of insertions and deletions
   * @return {void}
   */
  process(queue:[Array<*>, Array<*>], skipFlush?: boolean = false) {
    const [insertions, deletions] = queue;
    for (const [id, hash] of deletions) {
      this.deletions.set(id, hash);
    }
    for (const [hash, [id, value]] of insertions) {
      if (this.deletions.has(id)) {
        continue;
      }
      const pair = this.pairs.get(hash);
      if (!pair || (pair && pair[0] < id)) {
        this.pairs.set(hash, [id, value]);
        if (!pair) {
          this.emit('add', value, pair ? pair[1] : undefined);
        }
      }
    }
    for (const [id, hash] of deletions) {
      const pair = this.pairs.get(hash);
      if (pair && pair[0] === id) {
        this.pairs.delete(hash);
        this.emit('delete', pair[1]);
      }
    }
    if (!skipFlush) {
      this.flush();
    }
  }

  add(value:T, id?:string = generateId()) {
    const hash = this.hash(value);
    const pair = this.pairs.get(hash);
    const insertMessage = [hash, [id, value]];
    if (pair) {
      const deleteMessage = [pair[0], hash];
      this.process([[insertMessage], [deleteMessage]], true);
      this.deleteQueue.push(deleteMessage);
    } else {
      this.process([[insertMessage], []], true);
    }
    this.insertQueue.push(insertMessage);
    this.dequeue();
    return this;
  }

  delete(value:T) {
    const hash = this.hash(value);
    const pair = this.pairs.get(hash);
    if (pair) {
      const message = [pair[0], hash];
      this.process([[], [message]], true);
      this.deleteQueue.push(message);
      this.dequeue();
    }
  }

  clear() {
    for (const value of this) {
      this.delete(value);
    }
  }

  * entries():Iterator<[T, T]> {
    for (const [id, value] of this.pairs.values()) { // eslint-disable-line no-unused-vars
      yield [value, value];
    }
  }

  forEach(callback:Function, thisArg?:any) {
    if (thisArg) {
      for (const value of this.pairs.values()) {
        callback.bind(thisArg)(value, value, this);
      }
    } else {
      for (const value of this.pairs.values()) {
        callback(value, value, this);
      }
    }
  }

  has(value:T):boolean {
    return !!this.pairs.get(this.hash(value));
  }

  activeIds(value:T):Array<string> {
    const hash = this.hash(value);
    const pair = this.pairs.get(hash);
    if (!pair) {
      return [];
    }
    return [pair[0]];
  }

  * keys():Iterator<T> {
    for (const [id, value] of this.pairs.values()) { // eslint-disable-line no-unused-vars
      yield value;
    }
  }

  * values():Iterator<T> {
    for (const [id, value] of this.pairs.values()) { // eslint-disable-line no-unused-vars
      yield value;
    }
  }

  hash(value:T):string {
    return hasher(value);
  }

  get size():number {
    return this.pairs.size;
  }
}

module.exports = ObservedRemoveSet;
