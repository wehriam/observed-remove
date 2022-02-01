// @flow

import expect from 'expect';
import NodeRSA from 'node-rsa';
import { generateValue } from './lib/values';
import { getSigner, getVerifier } from '../src';

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
