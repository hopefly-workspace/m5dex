import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeQuantityForTyping, validateQuantity } from './marketPrecisionValidator.js';

test('crypto major allows up to 4 decimals', () => {
  const valid = validateQuantity('1.2345', 'crypto', { assetType: 'major', assetLabel: 'BTC' });
  const invalid = validateQuantity('1.23456', 'crypto', { assetType: 'major', assetLabel: 'BTC' });
  assert.equal(valid.isValid, true);
  assert.equal(invalid.isValid, false);
  assert.match(invalid.errorMessage, /Max 4 decimal places/);
});

test('crypto stablecoin uses 2 decimals', () => {
  const valid = validateQuantity('100.50', 'crypto', { assetType: 'stablecoin', assetLabel: 'USDT' });
  const invalid = validateQuantity('100.501', 'crypto', { assetType: 'stablecoin', assetLabel: 'USDT' });
  assert.equal(valid.isValid, true);
  assert.equal(invalid.isValid, false);
});

test('crypto rejects zero quantity', () => {
  const zero = validateQuantity('0', 'crypto', { assetType: 'major', assetLabel: 'BTC' });
  const zeroDecimal = validateQuantity('0.0', 'crypto', { assetType: 'major', assetLabel: 'BTC' });
  assert.equal(zero.isValid, false);
  assert.equal(zeroDecimal.isValid, false);
  assert.match(zero.errorMessage, /greater than 0/);
});

test('forex enforces min, max and 0.01 step', () => {
  const minInvalid = validateQuantity('0', 'forex', { maxLot: 100 });
  const maxInvalid = validateQuantity('100.01', 'forex', { maxLot: 100 });
  const valid = validateQuantity('0.09', 'forex', { maxLot: 100 });
  assert.equal(minInvalid.isValid, false);
  assert.equal(maxInvalid.isValid, false);
  assert.equal(valid.isValid, true);
});

test('indian f&o lot count is integer only (no decimals)', () => {
  const decimalInvalid = validateQuantity('2.5', 'indian_fo');
  const zeroInvalid = validateQuantity('0', 'indian_fo');
  const valid = validateQuantity('5', 'indian_fo');
  assert.equal(decimalInvalid.isValid, false);
  assert.match(decimalInvalid.errorMessage, /whole number/i);
  assert.equal(zeroInvalid.isValid, false);
  assert.equal(valid.isValid, true);
  assert.equal(valid.sanitizedValue, '5');
});

test('typing sanitizer handles empty and malformed input', () => {
  assert.equal(sanitizeQuantityForTyping('', 'crypto', { assetType: 'major' }), '');
  assert.equal(sanitizeQuantityForTyping('.', 'crypto', { assetType: 'major' }), '0.');
  assert.equal(sanitizeQuantityForTyping(' 00.10009 ', 'crypto', { assetType: 'major' }), '00.1000');
  assert.equal(sanitizeQuantityForTyping('-12.345', 'forex'), '12.345');
  assert.equal(sanitizeQuantityForTyping('25.5', 'indian_fo'), '25');
  assert.equal(sanitizeQuantityForTyping('1.99', 'indian_fo'), '1');
});

