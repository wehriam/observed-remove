# Observed-Remove set and map

[![CircleCI](https://circleci.com/gh/wehriam/observed-remove.svg?style=svg)](https://circleci.com/gh/wehriam/observed-remove) [![npm version](https://badge.fury.io/js/observed-remove.svg)](http://badge.fury.io/js/observed-remove) [![codecov](https://codecov.io/gh/wehriam/observed-remove/branch/master/graph/badge.svg)](https://codecov.io/gh/wehriam/observed-remove)

Eventually-consistent, conflict-free replicated data types (CRDT) [implemented](https://github.com/wehriam/observed-remove/blob/master/src/index.js) using native `Map` and `Set` objects.

```js
const { ObservedRemoveSet } = require('observed-remove');

const alice = new ObservedRemoveSet();
const bob = new ObservedRemoveSet();

alice.on('publish', (message) => {
  setTimeout(() => bob.process(message), Math.round(Math.random() * 1000));
});

bob.on('publish', (message) => {
  setTimeout(() => bob.process(message), Math.round(Math.random() * 1000));
});

alice.add('foo');
bob.add('bar');

// Later

alice.has('bar'); // true
bob.has('foo'); // true

```

```js
const { ObservedRemoveMap } = require('observed-remove');

const alice = new ObservedRemoveMap();
const bob = new ObservedRemoveMap();

alice.on('publish', (message) => {
  setTimeout(() => bob.process(message), Math.round(Math.random() * 1000));
});

bob.on('publish', (message) => {
  setTimeout(() => bob.process(message), Math.round(Math.random() * 1000));
});

alice.set('a', 1);
bob.add('b', 2);

// Later

alice.get('b'); // 2
bob.get('a'); // 1
```

## Install

`yarn add observed-remove`