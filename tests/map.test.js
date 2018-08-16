// @flow

const expect = require('expect');
const uuid = require('uuid');
const { ObservedRemoveMap } = require('../src');
const { generateValue } = require('./lib/values');

describe('Map', () => {
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
    const map = new ObservedRemoveMap([[keyA, valueA], [keyB, valueB], [keyC, valueC]], { maxAge: 0, bufferPublishing: 0 });
    expect(map.size).toEqual(3);
    map.clear();
    expect(map.size).toEqual(0);
    expect(map.insertQueue.length).toEqual(0);
    expect(map.deleteQueue.length).toEqual(0);
    expect(map.deletions.size).toEqual(3);
    map.flush();
    expect(map.size).toEqual(0);
    expect(map.insertQueue.length).toEqual(0);
    expect(map.deleteQueue.length).toEqual(0);
    expect(map.deletions.size).toEqual(0);
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

  test('Flush deletions', async () => {
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
    map.flush();
    expect(map.deletions.size).toEqual(3);
    await new Promise((resolve) => setTimeout(resolve, 200));
    map.flush();
    expect(map.deletions.size).toEqual(0);
  });

  test('Synchronize set and delete events', async () => {
    const keyX = uuid.v4();
    const keyY = uuid.v4();
    const valueX = generateValue();
    const valueY = generateValue();
    const alice = new ObservedRemoveMap();
    const bob = new ObservedRemoveMap();
    alice.on('publish', (message) => {
      bob.process(message);
    });
    bob.on('publish', (message) => {
      alice.process(message);
    });
    const aliceSetXPromise = new Promise((resolve) => {
      alice.once('set', (key, value) => {
        expect(key).toEqual(keyX);
        expect(value).toEqual(valueX);
        resolve();
      });
    });
    const aliceDeleteXPromise = new Promise((resolve) => {
      alice.once('delete', (key, value) => {
        expect(key).toEqual(keyX);
        expect(value).toEqual(valueX);
        resolve();
      });
    });
    bob.set(keyX, valueX);
    await aliceSetXPromise;
    bob.delete(keyX);
    await aliceDeleteXPromise;
    const bobSetYPromise = new Promise((resolve) => {
      bob.once('set', (key, value) => {
        expect(key).toEqual(keyY);
        expect(value).toEqual(valueY);
        resolve();
      });
    });
    const bobDeleteYPromise = new Promise((resolve) => {
      bob.once('delete', (key, value) => {
        expect(key).toEqual(keyY);
        expect(value).toEqual(valueY);
        resolve();
      });
    });
    alice.set(keyY, valueY);
    await bobSetYPromise;
    alice.delete(keyY);
    await bobDeleteYPromise;
  });

  test('Should not emit events for remote set/delete combos on sync', async () => {
    const keyX = uuid.v4();
    const keyY = uuid.v4();
    const valueX = generateValue();
    const valueY = generateValue();
    const alice = new ObservedRemoveMap();
    const bob = new ObservedRemoveMap();
    alice.set(keyX, valueX);
    alice.delete(keyX);
    bob.set(keyY, valueY);
    bob.delete(keyY);
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
    expect([...alice]).toEqual(expect.arrayContaining([[keyA, valueA], [keyX, valueX], [keyB, valueB], [keyY, valueY], [keyC, valueC], [keyZ, valueZ]]));
    expect([...bob]).toEqual(expect.arrayContaining([[keyA, valueA], [keyX, valueX], [keyB, valueB], [keyY, valueY], [keyC, valueC], [keyZ, valueZ]]));
  });

  test('Key-value pairs should not repeat', async () => {
    const key = uuid.v4();
    const value1 = generateValue();
    const value2 = generateValue();
    const alice = new ObservedRemoveMap();
    alice.set(key, value1);
    alice.set(key, value2);
    expect([...alice].length).toEqual(1);
    expect([...alice.entries()].length).toEqual(1);
    expect([...alice.keys()].length).toEqual(1);
    expect([...alice.values()].length).toEqual(1);
    expect([...alice]).toEqual([[key, value2]]);
    expect([...alice.entries()]).toEqual([[key, value2]]);
    expect([...alice.keys()]).toEqual([key]);
    expect([...alice.values()]).toEqual([value2]);
    expect(alice.get(key)).toEqual(value2);
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
      const map = new ObservedRemoveMap();
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

  test('Synchronize out of order sets', async () => {
    const alice = new ObservedRemoveMap([]);
    const bob = new ObservedRemoveMap([]);
    const key = uuid.v4();
    const value1 = generateValue();
    const value2 = generateValue();
    alice.set(key, value1);
    const aliceDump1 = alice.dump();
    alice.set(key, value2);
    const aliceDump2 = alice.dump();
    bob.process(aliceDump2);
    expect(bob.get(key)).toEqual(value2);
    bob.delete(key);
    expect(bob.get(key)).toBeUndefined();
    const bobDump1 = bob.dump();
    alice.process(bobDump1);
    expect(alice.get(key)).toBeUndefined();
    bob.process(aliceDump1);
    expect(alice.get(key)).toBeUndefined();
    expect(bob.get(key)).toBeUndefined();
    const bobDump2 = bob.dump();
    alice.process(bobDump2);
    expect(alice.get(key)).toBeUndefined();
    expect(bob.get(key)).toBeUndefined();
  });
});

