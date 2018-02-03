// @flow

const expect = require('expect');
const uuid = require('uuid');
const { SignedObservedRemoveMap, getSigner, generateId } = require('../src');
const { generateValue } = require('./lib/values');
const NodeRSA = require('node-rsa');

const privateKey = new NodeRSA({ b: 512 });
const sign = getSigner(privateKey.exportKey('pkcs1-private-pem'));
const key = privateKey.exportKey('pkcs1-public-pem');

test('Set and delete values', () => {
  let id;
  let ids;
  const keyA = uuid.v4();
  const keyB = uuid.v4();
  const valueA = generateValue();
  const valueB = generateValue();
  const map = new SignedObservedRemoveMap([], { key });
  expect(map.size).toEqual(0);
  id = generateId();
  map.setSigned(keyA, valueA, id, sign(keyA, valueA, id));
  expect(map.has(keyA)).toEqual(true);
  expect(map.has(keyB)).toEqual(false);
  expect(map.size).toEqual(1);
  id = generateId();
  map.setSigned(keyB, valueB, id, sign(keyB, valueB, id));
  expect(map.has(keyA)).toEqual(true);
  expect(map.has(keyB)).toEqual(true);
  expect(map.size).toEqual(2);
  ids = map.activeIds(keyB);
  ids.forEach((d) => map.deleteSignedId(d, sign(d)));
  expect(map.has(keyA)).toEqual(true);
  expect(map.has(keyB)).toEqual(false);
  expect(map.size).toEqual(1);
  ids = map.activeIds(keyA);
  ids.forEach((d) => map.deleteSignedId(d, sign(d)));
  expect(map.has(keyA)).toEqual(false);
  expect(map.has(keyB)).toEqual(false);
  expect(map.size).toEqual(0);
  id = generateId();
  map.setSigned(keyA, valueA, id, sign(keyA, valueA, id));
  expect(map.has(keyA)).toEqual(true);
  expect(map.has(keyB)).toEqual(false);
  expect(map.size).toEqual(1);
  id = generateId();
  map.setSigned(keyB, valueB, id, sign(keyB, valueB, id));
  expect(map.has(keyA)).toEqual(true);
  expect(map.has(keyB)).toEqual(true);
  expect(map.size).toEqual(2);
  expect([...map.values()]).toEqual([valueA, valueB]);
  expect([...map.keys()]).toEqual([keyA, keyB]);
  expect([...map]).toEqual([[keyA, valueA], [keyB, valueB]]);
  expect([...map.entries()]).toEqual([[keyA, valueA], [keyB, valueB]]);
});

test('Emit set and delete events', async () => {
  let id;
  let ids;
  const keyA = uuid.v4();
  const keyB = uuid.v4();
  const valueA = generateValue();
  const valueB = generateValue();
  const map = new SignedObservedRemoveMap([], { key });
  const setAPromise = new Promise((resolve) => {
    map.once('set', (k, v) => {
      expect(k).toEqual(keyA);
      expect(v).toEqual(valueA);
      resolve();
    });
    id = generateId();
    map.setSigned(keyA, valueA, id, sign(keyA, valueA, id));
  });
  const setBPromise = new Promise((resolve) => {
    map.once('set', (k, v) => {
      expect(k).toEqual(keyB);
      expect(v).toEqual(valueB);
      resolve();
    });
    id = generateId();
    map.setSigned(keyB, valueB, id, sign(keyB, valueB, id));
  });
  await setAPromise;
  await setBPromise;
  const deleteAPromise = new Promise((resolve) => {
    map.once('delete', (k, v) => {
      expect(k).toEqual(keyA);
      expect(v).toEqual(valueA);
      resolve();
    });
    ids = map.activeIds(keyA);
    ids.forEach((d) => map.deleteSignedId(d, sign(d)));
  });
  const deleteBPromise = new Promise((resolve) => {
    map.once('delete', (k, v) => {
      expect(k).toEqual(keyB);
      expect(v).toEqual(valueB);
      resolve();
    });
    ids = map.activeIds(keyB);
    ids.forEach((d) => map.deleteSignedId(d, sign(d)));
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
  const idA = generateId();
  const idB = generateId();
  const idC = generateId();
  const map = new SignedObservedRemoveMap([[keyA, valueA, idA, sign(keyA, valueA, idA)], [keyB, valueB, idB, sign(keyB, valueB, idB)], [keyC, valueC, idC, sign(keyC, valueC, idC)]], { key });
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

test('Synchronize maps', async () => {
  let id;
  let ids;
  const keyX = uuid.v4();
  const keyY = uuid.v4();
  const keyZ = uuid.v4();
  const valueX = generateValue();
  const valueY = generateValue();
  const valueZ = generateValue();
  const alice = new SignedObservedRemoveMap([], { key });
  const bob = new SignedObservedRemoveMap([], { key });
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
  id = generateId();
  alice.setSigned(keyX, valueX, id, sign(keyX, valueX, id));
  id = generateId();
  alice.setSigned(keyY, valueY, id, sign(keyY, valueY, id));
  id = generateId();
  alice.setSigned(keyZ, valueZ, id, sign(keyZ, valueZ, id));
  while (aliceAddCount !== 3 || bobAddCount !== 3) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  expect(alice.get(keyX)).toEqual(valueX);
  expect(alice.get(keyY)).toEqual(valueY);
  expect(alice.get(keyZ)).toEqual(valueZ);
  expect(bob.get(keyX)).toEqual(valueX);
  expect(bob.get(keyY)).toEqual(valueY);
  expect(bob.get(keyZ)).toEqual(valueZ);
  expect([...alice]).toEqual([[keyX, valueX], [keyY, valueY], [keyZ, valueZ]]);
  expect([...bob]).toEqual([[keyX, valueX], [keyY, valueY], [keyZ, valueZ]]);
  ids = bob.activeIds(keyX);
  ids.forEach((d) => bob.deleteSignedId(d, sign(d)));
  ids = bob.activeIds(keyY);
  ids.forEach((d) => bob.deleteSignedId(d, sign(d)));
  ids = bob.activeIds(keyZ);
  ids.forEach((d) => bob.deleteSignedId(d, sign(d)));
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
  let ids;
  const keyX = uuid.v4();
  const keyY = uuid.v4();
  const keyZ = uuid.v4();
  const valueX = generateValue();
  const valueY = generateValue();
  const valueZ = generateValue();
  const idX = generateId();
  const idY = generateId();
  const idZ = generateId();
  const map = new SignedObservedRemoveMap([[keyX, valueX, idX, sign(keyX, valueX, idX)], [keyY, valueY, idY, sign(keyY, valueY, idY)], [keyZ, valueZ, idZ, sign(keyZ, valueZ, idZ)]], { maxAge: 100, key });
  ids = map.activeIds(keyX);
  ids.forEach((d) => map.deleteSignedId(d, sign(d)));
  ids = map.activeIds(keyY);
  ids.forEach((d) => map.deleteSignedId(d, sign(d)));
  ids = map.activeIds(keyZ);
  ids.forEach((d) => map.deleteSignedId(d, sign(d)));
  expect(map.deletions.size).toEqual(3);
  expect(map.insertions.size).toEqual(3);
  map.flush();
  expect(map.deletions.size).toEqual(3);
  expect(map.insertions.size).toEqual(3);
  await new Promise((resolve) => setTimeout(resolve, 200));
  map.flush();
  expect(map.deletions.size).toEqual(0);
  expect(map.insertions.size).toEqual(0);
});

test('Flush sets', async () => {
  let id;
  const keyX = uuid.v4();
  const keyY = uuid.v4();
  const keyZ = uuid.v4();
  const valueX = generateValue();
  const valueY = generateValue();
  const valueZ = generateValue();
  const idX = generateId();
  const idY = generateId();
  const idZ = generateId();
  const map = new SignedObservedRemoveMap([[keyX, valueX, idX, sign(keyX, valueX, idX)], [keyY, valueY, idY, sign(keyY, valueY, idY)], [keyZ, valueZ, idZ, sign(keyZ, valueZ, idZ)]], { key });
  map.flush();
  expect(map.deletions.size).toEqual(0);
  expect(map.insertions.size).toEqual(3);
  id = generateId();
  map.setSigned(keyX, valueX, id, sign(keyX, valueX, id));
  id = generateId();
  map.setSigned(keyY, valueY, id, sign(keyY, valueY, id));
  id = generateId();
  map.setSigned(keyZ, valueZ, id, sign(keyZ, valueZ, id));
  expect(map.deletions.size).toEqual(0);
  expect(map.insertions.size).toEqual(6);
  map.flush();
  expect(map.deletions.size).toEqual(0);
  expect(map.insertions.size).toEqual(3);
});

test('Synchronize set and delete events', async () => {
  let id;
  let ids;
  const keyX = uuid.v4();
  const keyY = uuid.v4();
  const valueX = generateValue();
  const valueY = generateValue();
  const alice = new SignedObservedRemoveMap([], { key });
  const bob = new SignedObservedRemoveMap([], { key });
  alice.on('publish', (message) => {
    bob.process(message);
  });
  bob.on('publish', (message) => {
    alice.process(message);
  });
  const aliceSetXPromise = new Promise((resolve) => {
    alice.once('set', (k, v) => {
      expect(k).toEqual(keyX);
      expect(v).toEqual(valueX);
      resolve();
    });
  });
  const aliceDeleteXPromise = new Promise((resolve) => {
    alice.once('delete', (k, v) => {
      expect(k).toEqual(keyX);
      expect(v).toEqual(valueX);
      resolve();
    });
  });
  id = generateId();
  bob.setSigned(keyX, valueX, id, sign(keyX, valueX, id));
  await aliceSetXPromise;
  ids = bob.activeIds(keyX);
  ids.forEach((d) => bob.deleteSignedId(d, sign(d)));
  await aliceDeleteXPromise;
  const bobSetYPromise = new Promise((resolve) => {
    bob.once('set', (k, v) => {
      expect(k).toEqual(keyY);
      expect(v).toEqual(valueY);
      resolve();
    });
  });
  const bobDeleteYPromise = new Promise((resolve) => {
    bob.once('delete', (k, v) => {
      expect(k).toEqual(keyY);
      expect(v).toEqual(valueY);
      resolve();
    });
  });
  id = generateId();
  alice.setSigned(keyY, valueY, id, sign(keyY, valueY, id));
  await bobSetYPromise;
  ids = alice.activeIds(keyY);
  ids.forEach((d) => alice.deleteSignedId(d, sign(d)));
  await bobDeleteYPromise;
});

test('Should not emit events for remote set/delete combos on sync', async () => {
  let id;
  let ids;
  const keyX = uuid.v4();
  const keyY = uuid.v4();
  const valueX = generateValue();
  const valueY = generateValue();
  const alice = new SignedObservedRemoveMap([], { key });
  const bob = new SignedObservedRemoveMap([], { key });
  id = generateId();
  alice.setSigned(keyX, valueX, id, sign(keyX, valueX, id));
  ids = alice.activeIds(keyX);
  ids.forEach((d) => alice.deleteSignedId(d, sign(d)));
  id = generateId();
  bob.setSigned(keyY, valueY, id, sign(keyY, valueY, id));
  ids = bob.activeIds(keyY);
  ids.forEach((d) => bob.deleteSignedId(d, sign(d)));
  await new Promise((resolve) => setTimeout(resolve, 250));
  const bobPromise = new Promise((resolve, reject) => {
    bob.once('set', () => {
      reject(new Error('Bob should not receive set event'));
    });
    bob.once('delete', () => {
      reject(new Error('Bob should not receive delete event'));
    });
    setTimeout(resolve, 500);
  });
  const alicePromise = new Promise((resolve, reject) => {
    alice.once('set', () => {
      reject(new Error('Alice should not receive set event'));
    });
    alice.once('delete', () => {
      reject(new Error('Alice should not receive delete event'));
    });
    setTimeout(resolve, 500);
  });
  alice.on('publish', (message) => {
    bob.process(message);
  });
  bob.on('publish', (message) => {
    alice.process(message);
  });
  alice.sync();
  bob.sync();
  await bobPromise;
  await alicePromise;
  expect(alice.get(keyX)).toBeUndefined();
  expect(alice.get(keyY)).toBeUndefined();
  expect(bob.get(keyX)).toBeUndefined();
  expect(bob.get(keyY)).toBeUndefined();
});

test('Synchronize mixed maps using sync', async () => {
  let id;
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
  const alice = new SignedObservedRemoveMap([], { key });
  const bob = new SignedObservedRemoveMap([], { key });
  id = generateId();
  alice.setSigned(keyA, valueA, id, sign(keyA, valueA, id));
  id = generateId();
  bob.setSigned(keyX, valueX, id, sign(keyX, valueX, id));
  id = generateId();
  alice.setSigned(keyB, valueB, id, sign(keyB, valueB, id));
  id = generateId();
  bob.setSigned(keyY, valueY, id, sign(keyY, valueY, id));
  id = generateId();
  alice.setSigned(keyC, valueC, id, sign(keyC, valueC, id));
  id = generateId();
  bob.setSigned(keyZ, valueZ, id, sign(keyZ, valueZ, id));
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

test('Key-value pairs should not repeat', async () => {
  let id;
  const k = uuid.v4();
  const value1 = generateValue();
  const value2 = generateValue();
  const alice = new SignedObservedRemoveMap([], { key });
  id = generateId();
  alice.setSigned(k, value1, id, sign(k, value1, id));
  id = generateId();
  alice.setSigned(k, value2, id, sign(k, value2, id));
  expect([...alice].length).toEqual(1);
  expect([...alice.entries()].length).toEqual(1);
  expect([...alice.keys()].length).toEqual(1);
  expect([...alice.values()].length).toEqual(1);
  expect([...alice]).toEqual([[k, value2]]);
  expect([...alice.entries()]).toEqual([[k, value2]]);
  expect([...alice.keys()]).toEqual([k]);
  expect([...alice.values()]).toEqual([value2]);
  expect(alice.get(k)).toEqual(value2);
});

test('Synchronizes 100 asynchrous maps', async () => {
  let id;
  let ids;
  const keyA = uuid.v4();
  const keyB = uuid.v4();
  const keyC = uuid.v4();
  const valueA = generateValue();
  const valueB = generateValue();
  const valueC = generateValue();
  const maps = [];
  const callbacks = [];
  const publish = (sourceId:number, message:Buffer) => {
    for (let i = 0; i < callbacks.length; i += 1) {
      const [targetId, callback] = callbacks[i];
      if (targetId === sourceId) {
        continue;
      }
      setTimeout(() => callback(message), Math.round(1000 * Math.random()));
    }
  };
  const subscribe = (targetId: number, callback:Function) => {
    callbacks.push([targetId, callback]);
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
    const map = new SignedObservedRemoveMap([], { key });
    map.on('publish', (message) => publish(i, message));
    subscribe(i, (message) => map.process(message));
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
  id = generateId();
  alice.setSigned(keyA, valueA, id, sign(keyA, valueA, id));
  id = generateId();
  bob.setSigned(keyB, valueB, id, sign(keyB, valueB, id));
  id = generateId();
  alice.setSigned(keyC, valueC, id, sign(keyC, valueC, id));
  while (aliceAddCount !== 3 || bobAddCount !== 3) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  ids = bob.activeIds(keyC);
  ids.forEach((d) => bob.deleteSignedId(d, sign(d)));
  ids = alice.activeIds(keyB);
  ids.forEach((d) => alice.deleteSignedId(d, sign(d)));
  ids = bob.activeIds(keyA);
  ids.forEach((d) => bob.deleteSignedId(d, sign(d)));
  while (aliceDeleteCount !== 3 || bobDeleteCount !== 3) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  expect([...alice]).toEqual([]);
  expect([...bob]).toEqual([]);
});

