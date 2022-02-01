// @flow

import { v4 as uuidv4 } from 'uuid';
import { ObservedRemoveMap } from '../src';
import { generateValue } from './lib/values';

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
    const start = Date.now();
    for (let i = 0; i < 100000; i += 1) {
      const key = uuidv4();
      const value = generateValue();
      map.set(key, value);
      if (i % 1000 === 1) {
        map.publish();
      }
    }
    console.log(Date.now() - start);
    console.log(JSON.stringify(memoryDelta(startMemoryUsage), null, 2));
  });
});

