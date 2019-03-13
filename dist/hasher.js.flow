// @flow

const objectHasherFactory = require('node-object-hash');

const objectHasher = objectHasherFactory({ sort: false, coerce: false });

module.exports = (value:any) => objectHasher.hash(value, { enc: 'utf8' });
