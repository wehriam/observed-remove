// @flow

const expect = require('expect');
const uuid = require('uuid');
const { ObservedRemoveSet } = require('../src');

const generateValue = (depth?:number = 0):any => {
  if (Math.random() < 0.4) {
    return 1000 * Math.random();
  }
  if (Math.random() < 0.4) {
    return uuid.v4();
  }
  if (depth > 2) {
    return { [uuid.v4()]: uuid.v4() };
  }
  const propertyCount = Math.round(Math.random() * 4);
  const o = {};
  for (let i = 0; i < propertyCount; i += 1) {
    o[uuid.v4()] = generateValue(depth + 1);
  }
  return o;
};

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
  const addAPromise = new Promise((resolve, reject) => {
    set.once('add', (x) => {
      if (x === A) {
        resolve();
      } else {
        reject('Invalid value');
      }
    });
    set.add(A);
  });
  const addBPromise = new Promise((resolve, reject) => {
    set.once('add', (x) => {
      if (x === B) {
        resolve();
      } else {
        reject('Invalid value');
      }
    });
    set.add(B);
  });
  await addAPromise;
  await addBPromise;
  const deleteAPromise = new Promise((resolve, reject) => {
    set.once('delete', (x) => {
      if (x === A) {
        resolve();
      } else {
        reject('Invalid value');
      }
    });
    set.delete(A);
  });
  const deleteBPromise = new Promise((resolve, reject) => {
    set.once('delete', (x) => {
      if (x === B) {
        resolve();
      } else {
        reject('Invalid value');
      }
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

