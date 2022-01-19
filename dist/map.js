//      

const { EventEmitter } = require('events');
const isEqual = require('lodash.isequal');
const hasher = require('./hasher');

                
                 
                          
  

/**
 * Class representing a Observed Remove Map
 *
 * Implements all methods and iterators of the native `Map` object in addition to the following.
 * See: {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map}
 */
class ObservedRemoveMap       extends EventEmitter {
                         
                                   
                                            
                                              
                                          
                                                    
                                           
                        

  /**
   * Create an observed-remove map.
   * @param {Iterable<[K,V]>} [entries=[]] Iterable of initial values
   * @param {Object} [options={}]
   * @param {String} [options.maxAge=5000] Max age of insertion/deletion identifiers
   * @param {String} [options.bufferPublishing=0] Interval by which to buffer 'publish' events
   */
  constructor(entries                   , options          = {}) {
    super();
    this.maxAge = typeof options.maxAge === 'undefined' ? 5000 : options.maxAge;
    this.bufferPublishing = typeof options.bufferPublishing === 'undefined' ? 0 : options.bufferPublishing;
    this.publishTimeout = null;
    this.pairs = new Map();
    this.deletions = new Map();
    this.insertQueue = [];
    this.deleteQueue = [];
    this.clock = 0;
    if (!entries) {
      return;
    }
    for (const [key, value] of entries) {
      this.set(key, value);
    }
  }

  /* :: @@iterator()                   { return ({}     ); } */
  // $FlowFixMe: computed property
  [Symbol.iterator]() {
    return this.entries();
  }

  incrementClock() {
    this.clock += 1;
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
    this.sync([insertQueue, deleteQueue, this.clock]);
  }

  flush() {
    const expiration = Date.now() - this.maxAge;
    for (const [id, [, wallclock]] of this.deletions) {
      if (wallclock < expiration) {
        this.deletions.delete(id);
      }
    }
  }

  /**
   * Emit a 'publish' event containing a specified queue or all of the set's insertions and deletions.
   * @param {Array<Array<any>>} queue - Array of insertions and deletions
   * @return {void}
   */
  sync(queue                                                              = this.dump()) {
    this.emit('publish', queue);
  }

  /**
   * Return an array containing all of the map's insertions and deletions.
   * @return {[Array<*>, Array<*>]>}
   */
  dump()                                                            {
    const insertions = [];
    for (const [key, [id, value]] of this.pairs) {
      insertions.push([key, id, value]);
    }
    const deletions = [];
    for (const [id, [key]] of this.deletions) {
      deletions.push([id, key]);
    }
    return [insertions, deletions, this.clock];
  }

  process([insertions, deletions, remoteClock]                                                           ) {
    this.clock = Math.max(this.clock, remoteClock);
    this.incrementClock();
    this._process(insertions, deletions, false); // eslint-disable-line no-underscore-dangle
  }

  _process(insertions                              , deletions                    , skipFlush         ) {
    if (typeof deletions !== 'undefined') {
      for (const [id, key] of deletions) {
        this.deletions.set(id, [key, Date.now()]);
      }
    }
    if (typeof insertions !== 'undefined') {
      for (const [key, id, value] of insertions) {
        if (this.deletions.has(id)) {
          continue;
        }
        const pair = this.pairs.get(key);
        if (!pair) {
          this.pairs.set(key, [id, value]);
          this.emit('set', key, value, pair && pair[1] ? pair[1] : undefined);
        } else if (pair[0] < id) {
          this.pairs.set(key, [id, value]);
          if (!isEqual(value, pair[1])) {
            this.emit('set', key, value, pair && pair[1] ? pair[1] : undefined);
          }
        } else if (pair[0] === id) {
          if (isEqual(value, pair[1])) {
            this.emit('affirm', key, value, pair ? pair[1] : undefined);
          } else if (hasher(value) > hasher(pair[1])) {
            this.pairs.set(key, [id, value]);
            this.emit('set', key, value, pair && pair[1] ? pair[1] : undefined);
          }
        }
      }
    }
    if (typeof deletions !== 'undefined') {
      for (const [id, key] of deletions) {
        const pair = this.pairs.get(key);
        if (pair && pair[0] === id) {
          this.pairs.delete(key);
          this.emit('delete', key, pair[1]);
        }
      }
    }
    if (!skipFlush) {
      this.flush();
    }
  }

  set(key  , value  ) {
    this.incrementClock();
    const id = this.clock;
    const pair = this.pairs.get(key);
    const insertMessage = typeof value === 'undefined' ? [key, id, undefined] : [key, id, value];
    if (pair) {
      const deleteMessage = [pair[0], key];
      this._process([insertMessage], [deleteMessage], true); // eslint-disable-line no-underscore-dangle
      this.deleteQueue.push(deleteMessage);
    } else {
      this._process([insertMessage], undefined, true); // eslint-disable-line no-underscore-dangle
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
      const deleteMessage = [pair[0], key];
      this._process(undefined, [deleteMessage], true); // eslint-disable-line no-underscore-dangle
      this.deleteQueue.push(deleteMessage);
      this.dequeue();
    }
  }

  clear()       {
    for (const key of this.keys()) {
      this.delete(key);
    }
  }

  * entries()                         {
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

  * values()                    {
    for (const [id, value] of this.pairs.values()) { // eslint-disable-line no-unused-vars
      yield value;
    }
  }

  get size()        {
    return this.pairs.size;
  }
}

module.exports = ObservedRemoveMap;
