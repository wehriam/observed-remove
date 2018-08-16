
const uuid = require('uuid');
const { ObservedRemoveMap } = require('../dist');

const COUNT = 1000000;

const alice = new ObservedRemoveMap();
const bob = new ObservedRemoveMap();

for (let i = 0; i < COUNT; i += 1) {
  const key = uuid.v4();
  const value = uuid.v4();
  alice.set(key, value);
}

const queue = alice.dump();

const start = Date.now();
bob.process(queue);
const delta = Date.now() - start;
console.log(`Processed ${COUNT} entries in ${delta} ms`);


