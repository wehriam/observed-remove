// @flow

const expect = require('expect');
const uuid = require('uuid');
const { ObservedRemoveMap } = require('../src');
const { generateValue } = require('./lib/values');

test('Set and delete values', () => {
  const keyA = uuid.v4();
  const keyB = uuid.v4();
  const valueA = generateValue();
  const valueB = generateValue();
  const map = new ObservedRemoveMap();
  expect(map.size).toEqual(0);
  map.set(keyA, valueA);
  expect(map.has(keyA)).toEqual(true);
  expect(map.has(keyB)).toEqual(false);
  expect(map.size).toEqual(1);
  map.set(keyB, valueB);
  expect(map.has(keyA)).toEqual(true);
  expect(map.has(keyB)).toEqual(true);
  expect(map.size).toEqual(2);
  map.delete(keyB);
  expect(map.has(keyA)).toEqual(true);
  expect(map.has(keyB)).toEqual(false);
  expect(map.size).toEqual(1);
  map.delete(keyA);
  expect(map.has(keyA)).toEqual(false);
  expect(map.has(keyB)).toEqual(false);
  expect(map.size).toEqual(0);
  map.set(keyA, valueA);
  expect(map.has(keyA)).toEqual(true);
  expect(map.has(keyB)).toEqual(false);
  expect(map.size).toEqual(1);
  map.set(keyB, valueB);
  expect(map.has(keyA)).toEqual(true);
  expect(map.has(keyB)).toEqual(true);
  expect(map.size).toEqual(2);
  expect([...map.values()]).toEqual([valueA, valueB]);
  expect([...map.keys()]).toEqual([keyA, keyB]);
  expect([...map]).toEqual([[keyA, valueA], [keyB, valueB]]);
  expect([...map.entries()]).toEqual([[keyA, valueA], [keyB, valueB]]);
});

test('Emit set and delete events', async () => {
  const keyA = uuid.v4();
  const keyB = uuid.v4();
  const valueA = generateValue();
  const valueB = generateValue();
  const map = new ObservedRemoveMap();
  const setAPromise = new Promise((resolve) => {
    map.once('set', (k, v) => {
      expect(k).toEqual(keyA);
      expect(v).toEqual(valueA);
      resolve();
    });
    map.set(keyA, valueA);
  });
  const setBPromise = new Promise((resolve) => {
    map.once('set', (k, v) => {
      expect(k).toEqual(keyB);
      expect(v).toEqual(valueB);
      resolve();
    });
    map.set(keyB, valueB);
  });
  await setAPromise;
  await setBPromise;
  const deleteAPromise = new Promise((resolve) => {
    map.once('delete', (k, v) => {
      expect(k).toEqual(keyA);
      expect(v).toEqual(valueA);
      resolve();
    });
    map.delete(keyA);
  });
  const deleteBPromise = new Promise((resolve) => {
    map.once('delete', (k, v) => {
      expect(k).toEqual(keyB);
      expect(v).toEqual(valueB);
      resolve();
    });
    map.delete(keyB);
  });
  await deleteAPromise;
  await deleteBPromise;
});


test('Iterate through values', () => {
  const keyA = uuid.v4();
  const keyB = uuid.v4();
  const keyC = uuid.v4();
  const valueA = generateValue();
  const valueB = generateValue();
  const valueC = generateValue();
  const map = new ObservedRemoveMap([[keyA, valueA], [keyB, valueB], [keyC, valueC]]);
  let i = 0;
  for (const [k, v] of map) { // eslint-disable-line no-restricted-syntax
    if (i === 0) {
      expect(k).toEqual(keyA);
      expect(v).toEqual(valueA);
    } else if (i === 1) {
      expect(k).toEqual(keyB);
      expect(v).toEqual(valueB);
    } else if (i === 2) {
      expect(k).toEqual(keyC);
      expect(v).toEqual(valueC);
    }
    i += 1;
  }
  map.forEach((v, k) => {
    if (k === keyA) {
      expect(v).toEqual(valueA);
    } else if (k === keyB) {
      expect(v).toEqual(valueB);
    } else if (k === keyC) {
      expect(v).toEqual(valueC);
    }
  });
});

test('Clear values', () => {
  const keyA = uuid.v4();
  const keyB = uuid.v4();
  const keyC = uuid.v4();
  const valueA = generateValue();
  const valueB = generateValue();
  const valueC = generateValue();
  const map = new ObservedRemoveMap([[keyA, valueA], [keyB, valueB], [keyC, valueC]]);
  expect(map.size).toEqual(3);
  map.clear();
  expect(map.size).toEqual(0);
});


test('Synchronize maps', async () => {
  const keyX = uuid.v4();
  const keyY = uuid.v4();
  const keyZ = uuid.v4();
  const valueX = generateValue();
  const valueY = generateValue();
  const valueZ = generateValue();
  const alice = new ObservedRemoveMap();
  const bob = new ObservedRemoveMap();
  let aliceAddCount = 0;
  let bobAddCount = 0;
  let aliceDeleteCount = 0;
  let bobDeleteCount = 0;
  alice.on('set', () => (aliceAddCount += 1));
  bob.on('set', () => (bobAddCount += 1));
  alice.on('delete', () => (aliceDeleteCount += 1));
  bob.on('delete', () => (bobDeleteCount += 1));
  alice.on('publish', (message) => {
    bob.process(message);
  });
  bob.on('publish', (message) => {
    alice.process(message);
  });
  alice.set(keyX, valueX);
  alice.set(keyY, valueY);
  alice.set(keyZ, valueZ);
  while (aliceAddCount !== 3 || bobAddCount !== 3) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  expect(alice.get(keyX)).toEqual(valueX);
  expect(alice.get(keyY)).toEqual(valueY);
  expect(alice.get(keyZ)).toEqual(valueZ);
  expect(bob.get(keyX)).toEqual(valueX);
  expect(bob.get(keyY)).toEqual(valueY);
  expect(bob.get(keyZ)).toEqual(valueZ);
  expect([...alice]).toEqual([[keyX, valueX], [keyY, valueY], [keyZ, valueZ]]);
  expect([...bob]).toEqual([[keyX, valueX], [keyY, valueY], [keyZ, valueZ]]);
  bob.delete(keyX);
  bob.delete(keyY);
  bob.delete(keyZ);
  while (aliceDeleteCount !== 3 || bobDeleteCount !== 3) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  expect(alice.get(keyX)).toBeUndefined();
  expect(alice.get(keyY)).toBeUndefined();
  expect(alice.get(keyZ)).toBeUndefined();
  expect(bob.get(keyX)).toBeUndefined();
  expect(bob.get(keyY)).toBeUndefined();
  expect(bob.get(keyZ)).toBeUndefined();
  expect([...alice]).toEqual([]);
  expect([...bob]).toEqual([]);
});

test('Flush values', async () => {
  const keyX = uuid.v4();
  const keyY = uuid.v4();
  const keyZ = uuid.v4();
  const valueX = generateValue();
  const valueY = generateValue();
  const valueZ = generateValue();
  const map = new ObservedRemoveMap([[keyX, valueX], [keyY, valueY], [keyZ, valueZ]], { maxAge: 100 });
  map.delete(keyX);
  map.delete(keyY);
  map.delete(keyZ);
  expect(map.deletions.size).toEqual(3);
  expect(map.insertions.size).toEqual(3);
  map.flush();
  expect(map.deletions.size).toEqual(3);
  expect(map.insertions.size).toEqual(3);
  await new Promise((resolve) => setTimeout(resolve, 100));
  map.flush();
  expect(map.deletions.size).toEqual(0);
  expect(map.insertions.size).toEqual(0);
});


test('Synchronize mixed maps using sync', async () => {
  const keyA = uuid.v4();
  const keyB = uuid.v4();
  const keyC = uuid.v4();
  const keyX = uuid.v4();
  const keyY = uuid.v4();
  const keyZ = uuid.v4();
  const valueA = generateValue();
  const valueB = generateValue();
  const valueC = generateValue();
  const valueX = generateValue();
  const valueY = generateValue();
  const valueZ = generateValue();
  const alice = new ObservedRemoveMap();
  const bob = new ObservedRemoveMap();
  alice.set(keyA, valueA);
  bob.set(keyX, valueX);
  alice.set(keyB, valueB);
  bob.set(keyY, valueY);
  alice.set(keyC, valueC);
  bob.set(keyZ, valueZ);
  let aliceAddCount = 0;
  let bobAddCount = 0;
  let aliceDeleteCount = 0;
  let bobDeleteCount = 0;
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect([...alice]).toEqual([[keyA, valueA], [keyB, valueB], [keyC, valueC]]);
  expect([...bob]).toEqual([[keyX, valueX], [keyY, valueY], [keyZ, valueZ]]);
  alice.on('set', () => (aliceAddCount += 1));
  bob.on('set', () => (bobAddCount += 1));
  alice.on('delete', () => (aliceDeleteCount += 1));
  bob.on('delete', () => (bobDeleteCount += 1));
  alice.on('publish', (message) => {
    bob.process(message);
  });
  bob.on('publish', (message) => {
    alice.process(message);
  });
  alice.sync();
  bob.sync();
  while (aliceAddCount !== 3 || bobAddCount !== 3) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  expect([...alice]).toEqual([[keyA, valueA], [keyX, valueX], [keyB, valueB], [keyY, valueY], [keyC, valueC], [keyZ, valueZ]]);
  expect([...bob]).toEqual([[keyA, valueA], [keyX, valueX], [keyB, valueB], [keyY, valueY], [keyC, valueC], [keyZ, valueZ]]);
});


test('Synchronizes 100 asynchrous maps', async () => {
  const keyA = uuid.v4();
  const keyB = uuid.v4();
  const keyC = uuid.v4();
  const valueA = generateValue();
  const valueB = generateValue();
  const valueC = generateValue();
  const maps = [];
  const callbacks = [];
  const publish = (message:Buffer) => {
    for (let i = 0; i < callbacks.length; i += 1) {
      setTimeout(() => callbacks[i](message), Math.round(1000 * Math.random()));
    }
  };
  const subscribe = (callback:Function) => {
    callbacks.push(callback);
  };
  const getPair = () => {
    const mapA = maps[Math.floor(Math.random() * maps.length)];
    let mapB = mapA;
    while (mapB === mapA) {
      mapB = maps[Math.floor(Math.random() * maps.length)];
    }
    return [mapA, mapB];
  };
  for (let i = 0; i < 100; i += 1) {
    const map = new ObservedRemoveMap();
    map.on('publish', publish);
    subscribe((message) => map.process(message));
    maps.push(map);
  }
  const [alice, bob] = getPair();
  let aliceAddCount = 0;
  let bobAddCount = 0;
  let aliceDeleteCount = 0;
  let bobDeleteCount = 0;
  alice.on('set', () => (aliceAddCount += 1));
  bob.on('set', () => (bobAddCount += 1));
  alice.on('delete', () => (aliceDeleteCount += 1));
  bob.on('delete', () => (bobDeleteCount += 1));
  alice.set(keyA, valueA);
  bob.set(keyB, valueB);
  alice.set(keyC, valueC);
  while (aliceAddCount !== 3 || bobAddCount !== 3) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  bob.delete(keyC);
  alice.delete(keyB);
  bob.delete(keyA);
  while (aliceDeleteCount !== 3 || bobDeleteCount !== 3) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  expect([...alice]).toEqual([]);
  expect([...bob]).toEqual([]);
});

