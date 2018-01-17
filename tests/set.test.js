// @flow

const expect = require('expect');
const { ObservedRemoveSet } = require('../src');
const { generateValue } = require('./lib/values');

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
  for (const x of set) { // eslint-disable-line no-restricted-syntax
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

test('Clear values', () => {
  const A = generateValue();
  const B = generateValue();
  const C = generateValue();
  const set = new ObservedRemoveSet([A, B, C]);
  expect(set.size).toEqual(3);
  set.clear();
  expect(set.size).toEqual(0);
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

test('Synchronizes 100 asynchrous sets', async () => {
  const A = generateValue();
  const B = generateValue();
  const C = generateValue();
  const sets = [];
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
    const setA = sets[Math.floor(Math.random() * sets.length)];
    let setB = setA;
    while (setB === setA) {
      setB = sets[Math.floor(Math.random() * sets.length)];
    }
    return [setA, setB];
  };
  for (let i = 0; i < 100; i += 1) {
    const set = new ObservedRemoveSet();
    set.on('publish', publish);
    subscribe((message) => set.process(message));
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
  bob.add(B);
  alice.add(C);
  while (aliceAddCount !== 3 || bobAddCount !== 3) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  bob.delete(C);
  alice.delete(B);
  bob.delete(A);
  while (aliceDeleteCount !== 3 || bobDeleteCount !== 3) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  expect([...alice]).toEqual([]);
  expect([...bob]).toEqual([]);
});

