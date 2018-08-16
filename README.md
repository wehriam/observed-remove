# Observed-Remove Set and Map

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
  setTimeout(() => alice.process(message), Math.round(Math.random() * 1000));
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
  setTimeout(() => alice.process(message), Math.round(Math.random() * 1000));
});

alice.set('a', 1);
bob.add('b', 2);

// Later

alice.get('b'); // 2
bob.get('a'); // 1
```

## Install

`yarn add observed-remove`

## Set API

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

#### Table of Contents

-   [ObservedRemoveSet](#observedremoveset)
    -   [Parameters](#parameters)
    -   [sync](#sync)
        -   [Parameters](#parameters-1)
    -   [dump](#dump)
    -   [process](#process)
        -   [Parameters](#parameters-2)

### ObservedRemoveSet

**Extends EventEmitter**

Class representing an observed-remove set

Implements all methods and iterators of the native `Set` object in addition to the following.
See: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set>

#### Parameters

-   `entries` **Iterable&lt;T>** Iterable of initial values (optional, default `[]`)
-   `options` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)**  (optional, default `{}`)

#### sync

Emit a 'publish' event containing a specified queue or all of the set's insertions and deletions.

##### Parameters

-   `queue` **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;any>>** Array of insertions and deletions (optional, default `this.dump()`)

Returns **void** 

#### dump

Return an array containing all of the set's insertions and deletions.

Returns **\[[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;any>, [Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;any>]** 

#### process

Process an array of insertion and deletions.

##### Parameters

-   `queue` **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;any>>** Array of insertions and deletions
-   `skipFlush` **[boolean](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)**  (optional, default `false`)

Returns **void** 

## Map API

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

#### Table of Contents

-   [ObservedRemoveMap](#observedremovemap)
    -   [Parameters](#parameters)
    -   [sync](#sync)
        -   [Parameters](#parameters-1)
    -   [dump](#dump)

### ObservedRemoveMap

**Extends EventEmitter**

Class representing a Observed Remove Map

Implements all methods and iterators of the native `Map` object in addition to the following.
See: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map>

#### Parameters

-   `entries` **Iterable&lt;\[K, V]>** 
-   `options` **Options**  (optional, default `{}`)

#### sync

Emit a 'publish' event containing a specified queue or all of the set's insertions and deletions.

##### Parameters

-   `queue` **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;any>>** Array of insertions and deletions (optional, default `this.dump()`)

Returns **void** 

#### dump

Return an array containing all of the map's insertions and deletions.

Returns **\[[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;any>, [Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;any>]** 
