// @flow

import NodeRSA from 'node-rsa';
import expect from 'expect';
import { v4 as uuidv4 } from 'uuid';
import { generateValue } from './lib/values';

import { InvalidSignatureError, SignedObservedRemoveMap, getSigner, generateId } from '../src';

const privateKey = new NodeRSA({ b: 512 });
const sign = getSigner(privateKey.exportKey('pkcs1-private-pem'));
const key = privateKey.exportKey('pkcs1-public-pem');

describe('Signed Map', () => {
  test('Set and delete values', () => {
    const keyA = uuidv4();
    const keyB = uuidv4();
    const valueA = generateValue();
    const valueB = generateValue();
    const map = new SignedObservedRemoveMap([], { key });
    expect(map.size).toEqual(0);
    const id1 = generateId();
    map.setSigned(keyA, valueA, id1, sign(keyA, valueA, id1));
    expect(map.has(keyA)).toEqual(true);
    expect(map.has(keyB)).toEqual(false);
    expect(map.size).toEqual(1);
    const id2 = generateId();
    map.setSigned(keyB, valueB, id2, sign(keyB, valueB, id2));
    expect(map.has(keyA)).toEqual(true);
    expect(map.has(keyB)).toEqual(true);
    expect(map.size).toEqual(2);
    map.deleteSigned(keyB, id2, sign(keyB, id2));
    expect(map.has(keyA)).toEqual(true);
    expect(map.has(keyB)).toEqual(false);
    expect(map.size).toEqual(1);
    map.deleteSigned(keyA, id1, sign(keyA, id1));
    expect(map.has(keyA)).toEqual(false);
    expect(map.has(keyB)).toEqual(false);
    expect(map.size).toEqual(0);
    const id3 = generateId();
    map.setSigned(keyA, valueA, id3, sign(keyA, valueA, id3));
    expect(map.has(keyA)).toEqual(true);
    expect(map.has(keyB)).toEqual(false);
    expect(map.size).toEqual(1);
    const id4 = generateId();
    map.setSigned(keyB, valueB, id4, sign(keyB, valueB, id4));
    expect(map.has(keyA)).toEqual(true);
    expect(map.has(keyB)).toEqual(true);
    expect(map.size).toEqual(2);
    expect([...map.values()]).toEqual([valueA, valueB]);
    expect([...map.keys()]).toEqual([keyA, keyB]);
    expect([...map]).toEqual([[keyA, valueA], [keyB, valueB]]);
    expect([...map.entries()]).toEqual([[keyA, valueA], [keyB, valueB]]);
  });

  test('Throw on invalid signatures', () => {
    const keyA = uuidv4();
    const valueA = generateValue();
    const map = new SignedObservedRemoveMap([], { key });
    expect(() => {
      new SignedObservedRemoveMap([[keyA, valueA, generateId(), '***']], { key }); // eslint-disable-line no-new
    }).toThrowError(InvalidSignatureError);
    expect(() => {
      map.setSigned(keyA, valueA, generateId(), '***');
    }).toThrowError(InvalidSignatureError);
    const id = generateId();
    map.setSigned(keyA, valueA, id, sign(keyA, valueA, id));
    expect(() => {
      map.deleteSigned(keyA, id, '***');
    }).toThrowError(InvalidSignatureError);
  });

  test('Throw on clear', () => {
    const map = new SignedObservedRemoveMap([], { key });
    expect(() => {
      map.clear();
    }).toThrow();
  });


  test('Throw on invalid synchronization', async () => {
    const alicePrivateKey = new NodeRSA({ b: 512 });
    const aliceSign = getSigner(alicePrivateKey.exportKey('pkcs1-private-pem'));
    const aliceKey = alicePrivateKey.exportKey('pkcs1-public-pem');
    const bobPrivateKey = new NodeRSA({ b: 512 });
    const bobSign = getSigner(bobPrivateKey.exportKey('pkcs1-private-pem'));
    const bobKey = bobPrivateKey.exportKey('pkcs1-public-pem');
    const keyX = uuidv4();
    const keyY = uuidv4();
    const valueX = generateValue();
    const valueY = generateValue();
    const alice = new SignedObservedRemoveMap([], { key: aliceKey });
    const bob = new SignedObservedRemoveMap([], { key: bobKey });
    const id1 = generateId();
    const bobMessage1 = await new Promise((resolve) => {
      bob.on('publish', (message) => {
        resolve(message);
      });
      bob.setSigned(keyX, valueX, id1, bobSign(keyX, valueX, id1));
    });
    expect(() => {
      alice.process(bobMessage1);
    }).toThrowError(InvalidSignatureError);
    const id2 = generateId();
    const aliceMessage1 = await new Promise((resolve) => {
      alice.on('publish', (message) => {
        resolve(message);
      });
      alice.setSigned(keyY, valueY, id2, aliceSign(keyY, valueY, id2));
    });
    expect(() => {
      bob.process(aliceMessage1);
    }).toThrowError(InvalidSignatureError);
    const bobMessage2 = await new Promise((resolve) => {
      bob.on('publish', (message) => {
        resolve(message);
      });
      bob.deleteSigned(keyX, id1, bobSign(keyX, id1));
    });
    expect(() => {
      alice.process(bobMessage2);
    }).toThrowError(InvalidSignatureError);
    const aliceMessage2 = await new Promise((resolve) => {
      alice.on('publish', (message) => {
        resolve(message);
      });
      alice.deleteSigned(keyY, id2, aliceSign(keyY, id2));
    });
    expect(() => {
      bob.process(aliceMessage2);
    }).toThrowError(InvalidSignatureError);
  });


  test('Emit set and delete events', async () => {
    const keyA = uuidv4();
    const keyB = uuidv4();
    const valueA = generateValue();
    const valueB = generateValue();
    const map = new SignedObservedRemoveMap([], { key });
    const id1 = generateId();
    const setAPromise = new Promise((resolve) => {
      map.once('set', (k, v) => {
        expect(k).toEqual(keyA);
        expect(v).toEqual(valueA);
        resolve();
      });
      map.setSigned(keyA, valueA, id1, sign(keyA, valueA, id1));
    });
    const id2 = generateId();
    const setBPromise = new Promise((resolve) => {
      map.once('set', (k, v) => {
        expect(k).toEqual(keyB);
        expect(v).toEqual(valueB);
        resolve();
      });
      map.setSigned(keyB, valueB, id2, sign(keyB, valueB, id2));
    });
    await setAPromise;
    await setBPromise;
    const deleteAPromise = new Promise((resolve) => {
      map.once('delete', (k, v) => {
        expect(k).toEqual(keyA);
        expect(v).toEqual(valueA);
        resolve();
      });
      map.deleteSigned(keyA, id1, sign(keyA, id1));
    });
    const deleteBPromise = new Promise((resolve) => {
      map.once('delete', (k, v) => {
        expect(k).toEqual(keyB);
        expect(v).toEqual(valueB);
        resolve();
      });
      map.deleteSigned(keyB, id2, sign(keyB, id2));
    });
    await deleteAPromise;
    await deleteBPromise;
  });

  test('Iterate through values', () => {
    const keyA = uuidv4();
    const keyB = uuidv4();
    const keyC = uuidv4();
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
    const keyX = uuidv4();
    const keyY = uuidv4();
    const keyZ = uuidv4();
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
    const id1 = generateId();
    alice.setSigned(keyX, valueX, id1, sign(keyX, valueX, id1));
    const id2 = generateId();
    alice.setSigned(keyY, valueY, id2, sign(keyY, valueY, id2));
    const id3 = generateId();
    alice.setSigned(keyZ, valueZ, id3, sign(keyZ, valueZ, id3));
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
    bob.deleteSigned(keyX, id1, sign(keyX, id1));
    bob.deleteSigned(keyY, id2, sign(keyY, id2));
    bob.deleteSigned(keyZ, id3, sign(keyZ, id3));
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
    const keyX = uuidv4();
    const keyY = uuidv4();
    const keyZ = uuidv4();
    const valueX = generateValue();
    const valueY = generateValue();
    const valueZ = generateValue();
    const idX = generateId();
    const idY = generateId();
    const idZ = generateId();
    const map = new SignedObservedRemoveMap([[keyX, valueX, idX, sign(keyX, valueX, idX)], [keyY, valueY, idY, sign(keyY, valueY, idY)], [keyZ, valueZ, idZ, sign(keyZ, valueZ, idZ)]], { maxAge: 100, key });
    map.deleteSigned(keyX, idX, sign(keyX, idX));
    map.deleteSigned(keyY, idY, sign(keyY, idY));
    map.deleteSigned(keyZ, idZ, sign(keyZ, idZ));
    expect(map.deletions.size).toEqual(3);
    expect(map.deletionSignatureMap.size).toEqual(3);
    map.flush();
    expect(map.deletions.size).toEqual(3);
    expect(map.deletionSignatureMap.size).toEqual(3);
    await new Promise((resolve) => setTimeout(resolve, 200));
    map.flush();
    expect(map.deletions.size).toEqual(0);
    expect(map.deletionSignatureMap.size).toEqual(0);
  });


  test('Synchronize set and delete events', async () => {
    const keyX = uuidv4();
    const keyY = uuidv4();
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
    const id1 = generateId();
    bob.setSigned(keyX, valueX, id1, sign(keyX, valueX, id1));
    await aliceSetXPromise;
    bob.deleteSigned(keyX, id1, sign(keyX, id1));
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
    const id2 = generateId();
    alice.setSigned(keyY, valueY, id2, sign(keyY, valueY, id2));
    await bobSetYPromise;
    alice.deleteSigned(keyY, id2, sign(keyY, id2));
    await bobDeleteYPromise;
  });

  test('Should not emit events for remote set/delete combos on sync', async () => {
    const keyX = uuidv4();
    const keyY = uuidv4();
    const valueX = generateValue();
    const valueY = generateValue();
    const alice = new SignedObservedRemoveMap([], { key });
    const bob = new SignedObservedRemoveMap([], { key });
    const id1 = generateId();
    alice.setSigned(keyX, valueX, id1, sign(keyX, valueX, id1));
    alice.deleteSigned(keyX, id1, sign(keyX, id1));
    const id2 = generateId();
    bob.setSigned(keyY, valueY, id2, sign(keyY, valueY, id2));
    bob.deleteSigned(keyY, id2, sign(keyY, id2));
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
    const keyA = uuidv4();
    const keyB = uuidv4();
    const keyC = uuidv4();
    const keyX = uuidv4();
    const keyY = uuidv4();
    const keyZ = uuidv4();
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
    expect([...alice]).toEqual(expect.arrayContaining([[keyA, valueA], [keyX, valueX], [keyB, valueB], [keyY, valueY], [keyC, valueC], [keyZ, valueZ]]));
    expect([...bob]).toEqual(expect.arrayContaining([[keyA, valueA], [keyX, valueX], [keyB, valueB], [keyY, valueY], [keyC, valueC], [keyZ, valueZ]]));
  });

  test('Key-value pairs should not repeat', async () => {
    let id;
    const k = uuidv4();
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
    const keyA = uuidv4();
    const keyB = uuidv4();
    const keyC = uuidv4();
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
    const id1 = generateId();
    alice.setSigned(keyA, valueA, id1, sign(keyA, valueA, id1));
    const id2 = generateId();
    bob.setSigned(keyB, valueB, id2, sign(keyB, valueB, id2));
    const id3 = generateId();
    alice.setSigned(keyC, valueC, id3, sign(keyC, valueC, id3));
    while (aliceAddCount !== 3 || bobAddCount !== 3) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    bob.deleteSigned(keyC, id3, sign(keyC, id3));
    alice.deleteSigned(keyB, id2, sign(keyB, id2));
    bob.deleteSigned(keyA, id1, sign(keyA, id1));
    while (aliceDeleteCount !== 3 || bobDeleteCount !== 3) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect([...alice]).toEqual([]);
    expect([...bob]).toEqual([]);
  });
});
