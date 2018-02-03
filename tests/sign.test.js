// @flow

const expect = require('expect');
const { getSigner, getVerifier } = require('../src');
const { generateValue } = require('./lib/values');
const NodeRSA = require('node-rsa');

const key = new NodeRSA({ b: 512 });

const sign = getSigner(key.exportKey('pkcs1-private-pem'));
const verify = getVerifier(key.exportKey('pkcs1-public-pem'));

test('Sign and verify values', () => {
  const A = generateValue();
  const B = generateValue();
  const signature = sign(A, B);
  expect(verify(signature, A, B)).toEqual(true);
  expect(verify(signature, A)).toEqual(false);
  expect(verify(signature, B)).toEqual(false);
  expect(verify(signature, B, A)).toEqual(false);
});
