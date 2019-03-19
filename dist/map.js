//      

const { EventEmitter } = require('events');
const generateId = require('./generate-id');

                
                 
                          
  

/**
 * Class representing a Observed Remove Map
 *
 * Implements all methods and iterators of the native `Map` object in addition to the following.
 * See: {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map}
 */
class ObservedRemoveMap       extends EventEmitter {
                 
                           
                             
                            
                        
                        
                                   

  constructor(entries                   , options          = {}) {
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
    const maxAgeString = (Date.now() - this.maxAge).toString(36).padStart(9, '0');
    for (const [id] of this.deletions) {
      if (id < maxAgeString) {
        this.deletions.delete(id);
      }
    }
  }

  /**
   * Emit a 'publish' event containing a specified queue or all of the set's insertions and deletions.
   * @param {Array<Array<any>>} queue - Array of insertions and deletions
   * @return {void}
   */
  sync(queue                        = this.dump()) {
    this.emit('publish', queue);
  }

  /**
   * Return an array containing all of the map's insertions and deletions.
   * @return {[Array<*>, Array<*>]>}
   */
  dump()                      {
    return [[...this.pairs], [...this.deletions]];
  }

  process(queue                     , skipFlush           = false) {
    const [insertions, deletions] = queue;
    for (const [id, key] of deletions) {
      this.deletions.set(id, key);
    }
    for (const [key, [id, value]] of insertions) {
      if (this.deletions.has(id)) {
        continue;
      }
      const pair = this.pairs.get(key);
      if (!pair || (pair && pair[0] < id)) {
        this.pairs.set(key, [id, value]);
        this.emit('set', key, value, pair ? pair[1] : undefined);
      }
    }
    for (const [id, key] of deletions) {
      const pair = this.pairs.get(key);
      if (pair && pair[0] === id) {
        this.pairs.delete(key);
        this.emit('delete', key, pair[1]);
      }
    }
    if (!skipFlush) {
      this.flush();
    }
  }

  set(key  , value  , id          = generateId()) {
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

  get(key  )           { // eslint-disable-line consistent-return
    const pair = this.pairs.get(key);
    if (pair) {
      return pair[1];
    }
  }

  delete(key  )      {
    const pair = this.pairs.get(key);
    if (pair) {
      const message = [pair[0], key];
      this.process([[], [message]], true);
      this.deleteQueue.push(message);
      this.dequeue();
    }
  }

  clear()       {
    for (const key of this.keys()) {
      this.delete(key);
    }
  }

  * entries()                  {
    for (const [key, [id, value]] of this.pairs) { // eslint-disable-line no-unused-vars
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
    return !!this.pairs.get(key);
  }

  keys()             {
    return this.pairs.keys();
  }

  * values()             {
    for (const [id, value] of this.pairs.values()) { // eslint-disable-line no-unused-vars
      yield value;
    }
  }

  get size()        {
    return this.pairs.size;
  }
}

module.exports = ObservedRemoveMap;
