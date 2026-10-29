import test from 'node:test';
import assert from 'node:assert/strict';

import { formatMoney } from '../src/paypal.js';

test('PayPal amounts are always formatted with two decimal places', () => {
  assert.equal(formatMoney(50), '50.00');
  assert.equal(formatMoney(12.5), '12.50');
  assert.equal(formatMoney(0.1 + 0.2), '0.30');
});
