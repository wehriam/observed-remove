// @flow

const { EventEmitter } = require('events');
const DirectedGraphMap = require('directed-graph-map');
const generateId = require('./generate-id');

type Options = {
  maxAge?:number,
  bufferPublishing?:number
};

type QueueType = Array<Array<any>>;

/**
 * Class representing a Observed Remove Map
 *
 * Implements all methods and iterators of the native `Map` object in addition to the following.
 * See: {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map}
 */
class ObservedRemoveMap<K, V> extends EventEmitter {
  maxAge: number;
  bufferPublishing: number;
  valueMap: Map<string, V>;
  keyMap: Map<K, string>;
  insertions: DirectedGraphMap;
  deletions: Set<string>;
  queue: QueueType;
  publishTimeout: null | TimeoutID;

  /**
   * Create an observed-remove map.
   * @param {Iterable<K, V>} [entries=[]] Iterable of initial values
   * @param {Object} [options={}]
   * @param {String} [options.maxAge=5000] Max age of insertion/deletion identifiers
   * @param {String} [options.bufferPublishing=20] Interval by which to buffer 'publish' events
   */
  constructor(entries?: Iterable<[K, V]>, options?:Options = {}) {
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
        this.valueMap.delete(id);
      }
    }
    for (const key of this.insertions.targets) {
      const ids = Array.from(this.insertions.getSources(key));
      ids.sort();
      for (let i = 0; i < ids.length - 1; i += 1) {
        const id = ids[i];
        this.insertions.removeEdge(id, key);
        this.deletions.delete(id);
        this.valueMap.delete(id);
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
   * Emit a 'publish' event containing a specified queue or all of the set's insertions and deletions.
   * @param {Array<Array<any>>} queue - Array of insertions and deletions
   * @return {void}
   */
  sync(queue?: QueueType = this.dump()) {
    this.emit('publish', queue);
  }

  /**
   * Process an array of insertion and deletions.
   * @param {Array<Array<any>>} queue - Array of insertions and deletions
   * @return {void}
   */
  process(queue: QueueType, skipFlush?: boolean = false) {
    let keys = new Set();
    for (const [id:string] of queue) {
      keys = new Set([...keys, ...this.insertions.getTargets(id)]);
    }
    const keyMap = new Map([...keys].map((key) => [key, this.activeId(key)]));
    const newKeys = new Set();
    for (const [id:string, tuple?:[string, any]] of queue) {
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
    if (!skipFlush) {
      this.flush();
    }
  }

  set(key:K, value:V, id?: string = generateId()) {
    const message = [id, [key, value]];
    this.process([message], true);
    this.queue.push(message);
    this.dequeue();
  }

  get(key:K) { // eslint-disable-line consistent-return
    const insertions = this.insertions.getSources(key);
    const activeIds = [...insertions].filter((id) => !this.deletions.has(id));
    activeIds.sort();
    const activeId = activeIds[activeIds.length - 1];
    if (activeId) {
      return this.valueMap.get(activeId);
    }
  }

  delete(key:K) {
    const activeIds = this.activeIds(key);
    const queue = activeIds.map((id) => [id]);
    this.process(queue, true);
    this.queue = this.queue.concat(queue);
    this.dequeue();
  }

  activeIds(key:K) {
    const insertions = this.insertions.getSources(key);
    return [...insertions].filter((id) => !this.deletions.has(id));
  }

  activeId(key:K) {
    const activeIds = this.activeIds(key);
    activeIds.sort();
    return activeIds[activeIds.length - 1];
  }

  clear() {
    for (const key of this.keys()) {
      this.delete(key);
    }
  }

  nativeMap():Map<K, V> {
    const insertions = this.insertions.sources;
    const ids = [...insertions].filter((id) => !this.deletions.has(id));
    ids.sort();
    const entries:Map<K, V> = new Map();
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      const value = this.valueMap.get(id);
      if (typeof value !== 'undefined') {
        this.insertions.getTargets(id).forEach((key) => {
          entries.set(key, value);
        });
      }
    }
    return entries;
  }

  entries():Iterable<[K, V]> {
    return this.nativeMap().entries();
  }

  forEach(callback:Function, thisArg?:any) {
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

  has(key:K) {
    const insertions = this.insertions.getSources(key);
    return [...insertions].filter((id) => !this.deletions.has(id)).length > 0;
  }

  keys():Iterable<K> {
    return this.nativeMap().keys();
  }

  values():Iterable<V> {
    return this.nativeMap().values();
  }

  get size():number {
    const insertions = this.insertions.sources;
    return [...insertions].filter((id) => !this.deletions.has(id)).length;
  }
}

module.exports = ObservedRemoveMap;
