//      

const getMurmurHash3 = require('imurmurhash');

module.exports = (value    ) => getMurmurHash3(typeof value === 'string' ? value : JSON.stringify(value)).result();
