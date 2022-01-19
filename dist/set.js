//      

const { EventEmitter } = require('events');
const hasher = require('./hasher');
const ObservedRemoveMap = require('./map');

                
                 
                          
  

/**
 * Class representing an observed-remove set
 *
 * Implements all methods and iterators of the native `Set` object in addition to the following.
 * See: {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set}
 */
class ObservedRemoveSet    extends EventEmitter {
                                            

                              
                              
                            
                                                                                                
                                                                                           
                                                                                                  
                            

  /**
   * Create an observed-remove set.
   * @param {Iterable<T>} [entries=[]] Iterable of initial values
   * @param {Object} [options={}]
   * @param {String} [options.maxAge=5000] Max age of insertion/deletion identifiers
   * @param {String} [options.bufferPublishing=0] Interval by which to buffer 'publish' events
   */
  constructor(entries              , options          = {}) {
    super();
    this.map = new ObservedRemoveMap(undefined, options);
    this.map.on('set', (key       , value  ) => { // eslint-disable-line no-unused-vars
      this.emit('add', value);
    });
    this.map.on('affirm', (key       , value  ) => { // eslint-disable-line no-unused-vars
      this.emit('affirm', value);
    });
    this.map.on('delete', (key       , value  ) => { // eslint-disable-line no-unused-vars
      this.emit('delete', value);
    });
    this.map.on('publish', (queue                                                                     ) => { // eslint-disable-line no-unused-vars
      this.emit('publish', queue);
    });
    this.dequeue = this.map.dequeue.bind(this.map);
    this.publish = this.map.publish.bind(this.map);
    this.flush = this.map.flush.bind(this.map);
    this.sync = this.map.sync.bind(this.map);
    this.dump = this.map.dump.bind(this.map);
    this.process = this.map.process.bind(this.map);
    this.clear = this.map.clear.bind(this.map);
    if (!entries) {
      return;
    }
    for (const value of entries) {
      this.add(value);
    }
  }

  hash(value  )        {
    return hasher(value);
  }

  has(value  )         {
    const hash = this.hash(value);
    return this.map.has(hash);
  }

  add(value  ) {
    const hash = this.hash(value);
    this.map.set(hash, value);
    return this;
  }

  delete(value  ) {
    const hash = this.hash(value);
    this.map.delete(hash);
  }

  /* :: @@iterator()              { return ({}     ); } */
  // $FlowFixMe: computed property
  [Symbol.iterator]() {
    return this.values();
  }

  forEach(callback         , thisArg     ) {
    if (thisArg) {
      for (const value of this.map.values()) {
        callback.bind(thisArg)(value, value, this);
      }
    } else {
      for (const value of this.map.values()) {
        callback(value, value, this);
      }
    }
  }

  * entries()                  {
    for (const value of this.map.values()) { // eslint-disable-line no-unused-vars
      if (typeof value === 'undefined') {
        continue;
      }
      yield [value, value];
    }
  }

  * keys()             {
    for (const value of this.map.values()) { // eslint-disable-line no-unused-vars
      if (typeof value === 'undefined') {
        continue;
      }
      yield value;
    }
  }

  * values()             {
    for (const value of this.map.values()) { // eslint-disable-line no-unused-vars
      if (typeof value === 'undefined') {
        continue;
      }
      yield value;
    }
  }

  get size()        {
    return this.map.size;
  }
}

module.exports = ObservedRemoveSet;

