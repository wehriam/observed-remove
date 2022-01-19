// @flow

const expect = require('expect');
const { ObservedRemoveSet } = require('../src');
const { generateValue } = require('./lib/values');


describe('Set', () => {
  test('Add and delete values', () => {
    const A = generateValue();
    const B = generateValue();
    const set = new ObservedRemoveSet();
    expect(set.size).toEqual(0);
    set.add(A);
    expect(set.has(A)).toEqual(true);
    expect(set.has(B)).toEqual(false);
    expect(set.size).toEqual(1);
    set.add(B);
    expect(set.has(A)).toEqual(true);
    expect(set.has(B)).toEqual(true);
    expect(set.size).toEqual(2);
    set.delete(B);
    expect(set.has(A)).toEqual(true);
    expect(set.has(B)).toEqual(false);
    expect(set.size).toEqual(1);
    set.delete(A);
    expect(set.has(A)).toEqual(false);
    expect(set.has(B)).toEqual(false);
    expect(set.size).toEqual(0);
    set.add(A);
    expect(set.has(A)).toEqual(true);
    expect(set.has(B)).toEqual(false);
    expect(set.size).toEqual(1);
    set.add(B);
    expect(set.has(A)).toEqual(true);
    expect(set.has(B)).toEqual(true);
    expect(set.size).toEqual(2);
    expect([...set.values()]).toEqual([A, B]);
    expect([...set]).toEqual([A, B]);
    expect([...set.entries()]).toEqual([[A, A], [B, B]]);
  });

  test('Emit add and delete events', async () => {
    const A = generateValue();
    const B = generateValue();
    const set = new ObservedRemoveSet();
    const addAPromise = new Promise((resolve) => {
      set.once('add', (x) => {
        expect(x).toEqual(A);
        resolve();
      });
      set.add(A);
    });
    const addBPromise = new Promise((resolve) => {
      set.once('add', (x) => {
        expect(x).toEqual(B);
        resolve();
      });
      set.add(B);
    });
    await addAPromise;
    await addBPromise;
    const deleteAPromise = new Promise((resolve) => {
      set.once('delete', (x) => {
        expect(x).toEqual(A);
        resolve();
      });
      set.delete(A);
    });
    const deleteBPromise = new Promise((resolve) => {
      set.once('delete', (x) => {
        expect(x).toEqual(B);
        resolve();
      });
      set.delete(B);
    });
    await deleteAPromise;
    await deleteBPromise;
  });

  test('Iterate through values', () => {
    const A = generateValue();
    const B = generateValue();
    const C = generateValue();
    const set = new ObservedRemoveSet([A, B, C]);
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

  test('Hashes objects', () => {
    const A = [{ example: 1 }];
    const B = [{ example: 1 }];
    const set = new ObservedRemoveSet([A, B]);
    expect(set.size).toEqual(1);
    expect(set.has(A)).toEqual(true);
    expect(set.has(B)).toEqual(true);
  });

  test('Clear values', () => {
    const A = generateValue();
    const B = generateValue();
    const C = generateValue();
    const set = new ObservedRemoveSet([A, B, C], { maxAge: -1, bufferPublishing: 0 });
    expect(set.size).toEqual(3);
    set.clear();
    expect(set.size).toEqual(0);
    expect(set.map.insertQueue.length).toEqual(0);
    expect(set.map.deleteQueue.length).toEqual(0);
    expect(set.map.deletions.size).toEqual(3);
    set.flush();
    expect(set.size).toEqual(0);
    expect(set.map.insertQueue.length).toEqual(0);
    expect(set.map.deleteQueue.length).toEqual(0);
    expect(set.map.deletions.size).toEqual(0);
  });

  test('Synchronize sets', async () => {
    const X = generateValue();
    const Y = generateValue();
    const Z = generateValue();
    const alice = new ObservedRemoveSet();
    const bob = new ObservedRemoveSet();
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
    alice.add(X);
    alice.add(Y);
    alice.add(Z);
    while (aliceAddCount !== 3 || bobAddCount !== 3) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect([...alice]).toEqual([X, Y, Z]);
    expect([...bob]).toEqual([X, Y, Z]);
    bob.delete(X);
    bob.delete(Y);
    bob.delete(Z);
    while (aliceDeleteCount !== 3 || bobDeleteCount !== 3) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect([...alice]).toEqual([]);
    expect([...bob]).toEqual([]);
  });

  test('Flush values', async () => {
    const X = generateValue();
    const Y = generateValue();
    const Z = generateValue();
    const set = new ObservedRemoveSet([X, Y, Z], { maxAge: 100 });
    set.delete(X);
    set.delete(Y);
    set.delete(Z);
    expect(set.map.deletions.size).toEqual(3);
    set.flush();
    expect(set.map.deletions.size).toEqual(3);
    await new Promise((resolve) => setTimeout(resolve, 200));
    set.flush();
    expect(set.map.deletions.size).toEqual(0);
  });

  test('Flush deletions from add events', async () => {
    const X = generateValue();
    const Y = generateValue();
    const Z = generateValue();
    const set = new ObservedRemoveSet([X, Y, Z], { maxAge: 100 });
    set.flush();
    expect(set.map.deletions.size).toEqual(0);
    set.add(X);
    set.add(Y);
    set.add(Z);
    expect(set.map.deletions.size).toEqual(3);
    await new Promise((resolve) => setTimeout(resolve, 200));
    set.flush();
    expect(set.map.deletions.size).toEqual(0);
  });

  test('Only send out delete events when values have changed', async () => {
    const X = generateValue();
    const set = new ObservedRemoveSet([X], { maxAge: 100 });
    const deletePromise = new Promise((resolve, reject) => {
      const handleDelete = () => {
        clearTimeout(timeout);
        reject(new Error('Delete event should not be trigged on add'));
      };
      const timeout = setTimeout(() => {
        set.removeListener('delete', handleDelete);
        resolve();
      }, 200);
      set.on('delete', handleDelete);
    });
    set.add(X);
    await deletePromise;
  });

  test('Do not send out add events if an element already exists in the set', async () => {
    const X = Math.random();
    const set = new ObservedRemoveSet([X], { maxAge: 100 });
    let count = 0;
    const handleAdd = () => {
      count += 1;
    };
    set.on('add', handleAdd);
    set.add(X);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(count).toEqual(0);
  });

  test('Synchronize add and delete events', async () => {
    const X = generateValue();
    const Y = generateValue();
    const alice = new ObservedRemoveSet();
    const bob = new ObservedRemoveSet();
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
    bob.add(X);
    await aliceAddXPromise;
    bob.delete(X);
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
    alice.add(Y);
    await bobAddYPromise;
    alice.delete(Y);
    await bobDeleteYPromise;
  });

  test('Should not emit events for remote set/delete combos on sync', async () => {
    const X = generateValue();
    const Y = generateValue();
    const alice = new ObservedRemoveSet();
    const bob = new ObservedRemoveSet();
    alice.add(X);
    alice.delete(X);
    bob.add(Y);
    bob.delete(Y);
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
    const A = generateValue();
    const B = generateValue();
    const C = generateValue();
    const X = generateValue();
    const Y = generateValue();
    const Z = generateValue();
    const alice = new ObservedRemoveSet();
    const bob = new ObservedRemoveSet();
    alice.add(A);
    bob.add(X);
    alice.add(B);
    bob.add(Y);
    alice.add(C);
    bob.add(Z);
    let aliceAddCount = 0;
    let bobAddCount = 0;
    let aliceDeleteCount = 0;
    let bobDeleteCount = 0;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(new Set([...alice])).toEqual(new Set([A, B, C]));
    expect(new Set([...bob])).toEqual(new Set([X, Y, Z]));
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
    expect(new Set([...alice])).toEqual(new Set([A, X, B, Y, C, Z]));
    expect(new Set([...bob])).toEqual(new Set([A, X, B, Y, C, Z]));
  });

  test('Values should not repeat', async () => {
    const value = generateValue();
    const alice = new ObservedRemoveSet();
    alice.add(value);
    alice.add(value);
    expect([...alice].length).toEqual(1);
    expect([...alice.values()].length).toEqual(1);
    expect([...alice.entries()].length).toEqual(1);
    expect([...alice]).toEqual([value]);
    expect([...alice.values()]).toEqual([value]);
    expect([...alice.entries()]).toEqual([[value, value]]);
  });

  test('Synchronizes 100 asynchrous sets', async () => {
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
      const set = new ObservedRemoveSet();
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
    alice.add(A);
    alice.add(B);
    alice.add(C);
    while (aliceAddCount !== 3 || bobAddCount !== 3) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    bob.delete(C);
    bob.delete(B);
    bob.delete(A);
    while (aliceDeleteCount !== 3 || bobDeleteCount !== 3) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect([...alice]).toEqual([]);
    expect([...bob]).toEqual([]);
  });
});

