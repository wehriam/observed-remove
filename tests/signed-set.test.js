// @flow

const expect = require('expect');
const { InvalidSignatureError, SignedObservedRemoveSet, getSigner, generateId } = require('../src');
const { generateValue } = require('./lib/values');
const NodeRSA = require('node-rsa');

const privateKey = new NodeRSA({ b: 512 });
const sign = getSigner(privateKey.exportKey('pkcs1-private-pem'));
const key = privateKey.exportKey('pkcs1-public-pem');

describe('Signed Set', () => {
  test('Add and delete values', () => {
    let id;
    let ids;
    const A = generateValue();
    const B = generateValue();
    const set = new SignedObservedRemoveSet([], { key });
    expect(set.size).toEqual(0);
    id = generateId();
    set.addSigned(A, id, sign(A, id));
    expect(set.has(A)).toEqual(true);
    expect(set.has(B)).toEqual(false);
    expect(set.size).toEqual(1);
    id = generateId();
    set.addSigned(B, id, sign(B, id));
    expect(set.has(A)).toEqual(true);
    expect(set.has(B)).toEqual(true);
    expect(set.size).toEqual(2);
    ids = set.activeIds(B);
    ids.forEach((d) => set.deleteSignedId(d, sign(d)));
    expect(set.has(A)).toEqual(true);
    expect(set.has(B)).toEqual(false);
    expect(set.size).toEqual(1);
    ids = set.activeIds(A);
    ids.forEach((d) => set.deleteSignedId(d, sign(d)));
    expect(set.has(A)).toEqual(false);
    expect(set.has(B)).toEqual(false);
    expect(set.size).toEqual(0);
    id = generateId();
    set.addSigned(A, id, sign(A, id));
    expect(set.has(A)).toEqual(true);
    expect(set.has(B)).toEqual(false);
    expect(set.size).toEqual(1);
    id = generateId();
    set.addSigned(B, id, sign(B, id));
    expect(set.has(A)).toEqual(true);
    expect(set.has(B)).toEqual(true);
    expect(set.size).toEqual(2);
    expect([...set.values()]).toEqual([A, B]);
    expect([...set]).toEqual([A, B]);
    expect([...set.entries()]).toEqual([[A, A], [B, B]]);
  });

  test('Throw on invalid signatures', () => {
    let id;
    const A = generateValue();
    const set = new SignedObservedRemoveSet([], { key });
    expect(() => {
      id = generateId();
      new SignedObservedRemoveSet([[A, id, '***']], { key }); // eslint-disable-line no-new
    }).toThrowError(InvalidSignatureError);
    expect(() => {
      id = generateId();
      set.addSigned(A, id, '***');
    }).toThrowError(InvalidSignatureError);
    id = generateId();
    set.addSigned(A, id, sign(A, id));
    expect(() => {
      const ids = set.activeIds(A);
      ids.forEach((d) => set.deleteSignedId(d, '***'));
    }).toThrowError(InvalidSignatureError);
  });

  test('Throw on clear', () => {
    const set = new SignedObservedRemoveSet([], { key });
    expect(() => {
      set.clear();
    }).toThrow();
  });

  test('Throw on invalid synchronization', async () => {
    let id;
    let ids;
    const alicePrivateKey = new NodeRSA({ b: 512 });
    const aliceSign = getSigner(alicePrivateKey.exportKey('pkcs1-private-pem'));
    const aliceKey = alicePrivateKey.exportKey('pkcs1-public-pem');
    const bobPrivateKey = new NodeRSA({ b: 512 });
    const bobSign = getSigner(bobPrivateKey.exportKey('pkcs1-private-pem'));
    const bobKey = bobPrivateKey.exportKey('pkcs1-public-pem');
    const X = generateValue();
    const Y = generateValue();
    const alice = new SignedObservedRemoveSet([], { key: aliceKey });
    const bob = new SignedObservedRemoveSet([], { key: bobKey });
    const bobMessage1 = await new Promise((resolve) => {
      bob.on('publish', (message) => {
        resolve(message);
      });
      id = generateId();
      bob.addSigned(X, id, bobSign(X, id));
    });
    expect(() => {
      alice.process(bobMessage1);
    }).toThrowError(InvalidSignatureError);
    const aliceMessage1 = await new Promise((resolve) => {
      alice.on('publish', (message) => {
        resolve(message);
      });
      id = generateId();
      alice.addSigned(Y, id, aliceSign(Y, id));
    });
    expect(() => {
      bob.process(aliceMessage1);
    }).toThrow();
    const bobMessage2 = await new Promise((resolve) => {
      bob.on('publish', (message) => {
        resolve(message);
      });
      ids = bob.activeIds(X);
      ids.forEach((d) => bob.deleteSignedId(d, bobSign(d)));
    });
    expect(() => {
      alice.process(bobMessage2);
    }).toThrowError(InvalidSignatureError);
    const aliceMessage2 = await new Promise((resolve) => {
      alice.on('publish', (message) => {
        resolve(message);
      });
      ids = alice.activeIds(Y);
      ids.forEach((d) => alice.deleteSignedId(d, aliceSign(d)));
    });
    expect(() => {
      bob.process(aliceMessage2);
    }).toThrowError(InvalidSignatureError);
  });

  test('Emit add and delete events', async () => {
    let id;
    let ids;
    const A = generateValue();
    const B = generateValue();
    const set = new SignedObservedRemoveSet([], { key });
    const addAPromise = new Promise((resolve) => {
      set.once('add', (x) => {
        expect(x).toEqual(A);
        resolve();
      });
      id = generateId();
      set.addSigned(A, id, sign(A, id));
    });
    const addBPromise = new Promise((resolve) => {
      set.once('add', (x) => {
        expect(x).toEqual(B);
        resolve();
      });
      id = generateId();
      set.addSigned(B, id, sign(B, id));
    });
    await addAPromise;
    await addBPromise;
    const deleteAPromise = new Promise((resolve) => {
      set.once('delete', (x) => {
        expect(x).toEqual(A);
        resolve();
      });
      ids = set.activeIds(A);
      ids.forEach((d) => set.deleteSignedId(d, sign(d)));
    });
    const deleteBPromise = new Promise((resolve) => {
      set.once('delete', (x) => {
        expect(x).toEqual(B);
        resolve();
      });
      ids = set.activeIds(B);
      ids.forEach((d) => set.deleteSignedId(d, sign(d)));
    });
    await deleteAPromise;
    await deleteBPromise;
  });


  test('Iterate through values', () => {
    const A = generateValue();
    const B = generateValue();
    const C = generateValue();
    const idA = generateId();
    const idB = generateId();
    const idC = generateId();
    const set = new SignedObservedRemoveSet([[A, idA, sign(A, idA)], [B, idB, sign(B, idB)], [C, idC, sign(C, idC)]], { key });
    let i = 0;
    for (const x of set) {
      if (i === 0) {
        expect(x).toEqual(A);
      } else if (i === 1) {
        expect(x).toEqual(B);
      } else if (i === 2) {
        expect(x).toEqual(C);
      }
      i += 1;
    }
    set.forEach((x, index) => {
      if (index === 0) {
        expect(x).toEqual(A);
      } else if (index === 1) {
        expect(x).toEqual(B);
      } else if (index === 2) {
        expect(x).toEqual(C);
      }
    });
  });


  test('Synchronize sets', async () => {
    let id;
    let ids;
    const X = generateValue();
    const Y = generateValue();
    const Z = generateValue();
    const alice = new SignedObservedRemoveSet([], { key });
    const bob = new SignedObservedRemoveSet([], { key });
    let aliceAddCount = 0;
    let bobAddCount = 0;
    let aliceDeleteCount = 0;
    let bobDeleteCount = 0;
    alice.on('add', () => (aliceAddCount += 1));
    bob.on('add', () => (bobAddCount += 1));
    alice.on('delete', () => (aliceDeleteCount += 1));
    bob.on('delete', () => (bobDeleteCount += 1));
    alice.on('publish', (message) => {
      bob.process(message);
    });
    bob.on('publish', (message) => {
      alice.process(message);
    });
    id = generateId();
    alice.addSigned(X, id, sign(X, id));
    id = generateId();
    alice.addSigned(Y, id, sign(Y, id));
    id = generateId();
    alice.addSigned(Z, id, sign(Z, id));
    while (aliceAddCount !== 3 || bobAddCount !== 3) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect([...alice]).toEqual([X, Y, Z]);
    expect([...bob]).toEqual([X, Y, Z]);
    ids = bob.activeIds(X);
    ids.forEach((d) => bob.deleteSignedId(d, sign(d)));
    ids = bob.activeIds(Y);
    ids.forEach((d) => bob.deleteSignedId(d, sign(d)));
    ids = bob.activeIds(Z);
    ids.forEach((d) => bob.deleteSignedId(d, sign(d)));
    while (aliceDeleteCount !== 3 || bobDeleteCount !== 3) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect([...alice]).toEqual([]);
    expect([...bob]).toEqual([]);
  });


  test('Flush values', async () => {
    let ids;
    const A = generateValue();
    const B = generateValue();
    const C = generateValue();
    const idA = generateId();
    const idB = generateId();
    const idC = generateId();
    const set = new SignedObservedRemoveSet([[A, idA, sign(A, idA)], [B, idB, sign(B, idB)], [C, idC, sign(C, idC)]], { key, maxAge: 100 });
    ids = set.activeIds(A);
    ids.forEach((d) => set.deleteSignedId(d, sign(d)));
    ids = set.activeIds(B);
    ids.forEach((d) => set.deleteSignedId(d, sign(d)));
    ids = set.activeIds(C);
    ids.forEach((d) => set.deleteSignedId(d, sign(d)));
    expect(set.deletions.size).toEqual(3);
    expect(set.insertions.size).toEqual(3);
    set.flush();
    expect(set.deletions.size).toEqual(3);
    expect(set.insertions.size).toEqual(3);
    await new Promise((resolve) => setTimeout(resolve, 100));
    set.flush();
    expect(set.deletions.size).toEqual(0);
    expect(set.insertions.size).toEqual(0);
  });


  test('Flush adds', async () => {
    let id;
    const A = generateValue();
    const B = generateValue();
    const C = generateValue();
    const idA = generateId();
    const idB = generateId();
    const idC = generateId();
    const set = new SignedObservedRemoveSet([[A, idA, sign(A, idA)], [B, idB, sign(B, idB)], [C, idC, sign(C, idC)]], { key });
    set.flush();
    expect(set.deletions.size).toEqual(0);
    expect(set.insertions.size).toEqual(3);
    id = generateId();
    set.addSigned(A, id, sign(A, id));
    id = generateId();
    set.addSigned(B, id, sign(B, id));
    id = generateId();
    set.addSigned(C, id, sign(C, id));
    expect(set.deletions.size).toEqual(0);
    expect(set.insertions.size).toEqual(6);
    set.flush();
    expect(set.deletions.size).toEqual(0);
    expect(set.insertions.size).toEqual(3);
  });


  test('Synchronize add and delete events', async () => {
    let id;
    let ids;
    const X = generateValue();
    const Y = generateValue();
    const alice = new SignedObservedRemoveSet([], { key });
    const bob = new SignedObservedRemoveSet([], { key });
    alice.on('publish', (message) => {
      bob.process(message);
    });
    bob.on('publish', (message) => {
      alice.process(message);
    });
    const aliceAddXPromise = new Promise((resolve) => {
      alice.once('add', (value) => {
        expect(value).toEqual(X);
        resolve();
      });
    });
    const aliceDeleteXPromise = new Promise((resolve) => {
      alice.once('delete', (value) => {
        expect(value).toEqual(X);
        resolve();
      });
    });
    id = generateId();
    bob.addSigned(X, id, sign(X, id));
    await aliceAddXPromise;
    ids = bob.activeIds(X);
    ids.forEach((d) => bob.deleteSignedId(d, sign(d)));
    await aliceDeleteXPromise;
    const bobAddYPromise = new Promise((resolve) => {
      bob.once('add', (value) => {
        expect(value).toEqual(Y);
        resolve();
      });
    });
    const bobDeleteYPromise = new Promise((resolve) => {
      bob.once('delete', (value) => {
        expect(value).toEqual(Y);
        resolve();
      });
    });
    id = generateId();
    alice.addSigned(Y, id, sign(Y, id));
    await bobAddYPromise;
    ids = alice.activeIds(Y);
    ids.forEach((d) => alice.deleteSignedId(d, sign(d)));
    await bobDeleteYPromise;
  });

  test('Should not emit events for remote set/delete combos on sync', async () => {
    let id;
    let ids;
    const X = generateValue();
    const Y = generateValue();
    const alice = new SignedObservedRemoveSet([], { key });
    const bob = new SignedObservedRemoveSet([], { key });
    id = generateId();
    alice.addSigned(X, id, sign(X, id));
    ids = alice.activeIds(X);
    ids.forEach((d) => alice.deleteSignedId(d, sign(d)));
    id = generateId();
    bob.addSigned(Y, id, sign(Y, id));
    ids = bob.activeIds(Y);
    ids.forEach((d) => bob.deleteSignedId(d, sign(d)));
    await new Promise((resolve) => setTimeout(resolve, 250));
    const bobPromise = new Promise((resolve, reject) => {
      bob.once('add', () => {
        reject(new Error('Bob should not receive add event'));
      });
      bob.once('delete', () => {
        reject(new Error('Bob should not receive delete event'));
      });
      setTimeout(resolve, 500);
    });
    const alicePromise = new Promise((resolve, reject) => {
      alice.once('add', () => {
        reject(new Error('Alice should not receive add event'));
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
    expect(alice.has(X)).toEqual(false);
    expect(alice.has(Y)).toEqual(false);
    expect(bob.has(X)).toEqual(false);
    expect(bob.has(Y)).toEqual(false);
  });

  test('Synchronize mixed sets using sync', async () => {
    let id;
    const A = generateValue();
    const B = generateValue();
    const C = generateValue();
    const X = generateValue();
    const Y = generateValue();
    const Z = generateValue();
    const alice = new SignedObservedRemoveSet([], { key });
    const bob = new SignedObservedRemoveSet([], { key });
    id = generateId();
    alice.addSigned(A, id, sign(A, id));
    id = generateId();
    bob.addSigned(X, id, sign(X, id));
    id = generateId();
    alice.addSigned(B, id, sign(B, id));
    id = generateId();
    bob.addSigned(Y, id, sign(Y, id));
    id = generateId();
    alice.addSigned(C, id, sign(C, id));
    id = generateId();
    bob.addSigned(Z, id, sign(Z, id));
    let aliceAddCount = 0;
    let bobAddCount = 0;
    let aliceDeleteCount = 0;
    let bobDeleteCount = 0;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect([...alice]).toEqual([A, B, C]);
    expect([...bob]).toEqual([X, Y, Z]);
    alice.on('add', () => (aliceAddCount += 1));
    bob.on('add', () => (bobAddCount += 1));
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
    expect([...alice]).toEqual([A, X, B, Y, C, Z]);
    expect([...bob]).toEqual([A, X, B, Y, C, Z]);
  });


  test('Values should not repeat', async () => {
    let id;
    const value = generateValue();
    const alice = new SignedObservedRemoveSet([], { key });
    id = generateId();
    alice.addSigned(value, id, sign(value, id));
    id = generateId();
    alice.addSigned(value, id, sign(value, id));
    expect([...alice].length).toEqual(1);
    expect([...alice.values()].length).toEqual(1);
    expect([...alice.entries()].length).toEqual(1);
    expect([...alice]).toEqual([value]);
    expect([...alice.values()]).toEqual([value]);
    expect([...alice.entries()]).toEqual([[value, value]]);
  });

  test('Synchronizes 100 asynchrous sets', async () => {
    let id;
    let ids;
    const A = generateValue();
    const B = generateValue();
    const C = generateValue();
    const sets = [];
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
      const setA = sets[Math.floor(Math.random() * sets.length)];
      let setB = setA;
      while (setB === setA) {
        setB = sets[Math.floor(Math.random() * sets.length)];
      }
      return [setA, setB];
    };
    for (let i = 0; i < 100; i += 1) {
      const set = new SignedObservedRemoveSet([], { key });
      set.on('publish', (message) => publish(i, message));
      subscribe(i, (message) => set.process(message));
      sets.push(set);
    }
    const [alice, bob] = getPair();
    let aliceAddCount = 0;
    let bobAddCount = 0;
    let aliceDeleteCount = 0;
    let bobDeleteCount = 0;
    alice.on('add', () => (aliceAddCount += 1));
    bob.on('add', () => (bobAddCount += 1));
    alice.on('delete', () => (aliceDeleteCount += 1));
    bob.on('delete', () => (bobDeleteCount += 1));
    id = generateId();
    alice.addSigned(A, id, sign(A, id));
    id = generateId();
    alice.addSigned(B, id, sign(B, id));
    id = generateId();
    alice.addSigned(C, id, sign(C, id));
    while (aliceAddCount !== 3 || bobAddCount !== 3) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    ids = bob.activeIds(C);
    ids.forEach((d) => bob.deleteSignedId(d, sign(d)));
    ids = bob.activeIds(B);
    ids.forEach((d) => bob.deleteSignedId(d, sign(d)));
    ids = bob.activeIds(A);
    ids.forEach((d) => bob.deleteSignedId(d, sign(d)));
    while (aliceDeleteCount !== 3 || bobDeleteCount !== 3) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect([...alice]).toEqual([]);
    expect([...bob]).toEqual([]);
  });
});

