// @flow

const getMurmurHash3 = require('imurmurhash');

module.exports = (value:any) => getMurmurHash3(typeof value === 'string' ? value : JSON.stringify(value)).result();
