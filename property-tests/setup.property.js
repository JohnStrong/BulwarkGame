/**
 * Property test setup verification.
 * Confirms fast-check is installed and the test:properties script works.
 * This file can be removed once real property tests are added.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

describe('Property test infrastructure', () => {
  it('fast-check is available and runs property tests', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        assert.strictEqual(typeof n, 'number');
      }),
      { numRuns: 100 }
    );
  });
});
