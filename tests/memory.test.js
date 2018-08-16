// @flow

// const expect = require('expect');
const uuid = require('uuid');
const { ObservedRemoveMap } = require('../src');
const { generateValue } = require('./lib/values');

const memoryDelta = (start:Object) => {
  const end = process.memoryUsage();
  const delta = {};
  Object.keys(end).forEach((key) => {
    const d = end[key] - start[key];
    delta[key] = Math.round(d / 1024 / 1024 * 100) / 100;
  });
  return delta;
};

describe('Map Memory Test', () => {
  test('Set and delete values', () => {
    const map = new ObservedRemoveMap();
    const startMemoryUsage = process.memoryUsage();
    for (let i = 0; i < 100000; i += 1) {
      const key = uuid.v4();
      const value = generateValue();
      map.set(key, value);
      if (i % 1000 === 1) {
        map.publish();
      }
    }
    console.log(JSON.stringify(memoryDelta(startMemoryUsage), null, 2));
  });
});

