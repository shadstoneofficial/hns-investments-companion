const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isFinalOwnership,
  normalizeBridgeName
} = require('../src/scanner/bobBridgeClient');

test('a reveal leader remains pending and receives no ownership expiration', () => {
  const name = normalizeBridgeName({
    name: 'example',
    status: 'auction-reveal-leading',
    auctionState: 'reveal',
    ownershipFinal: false,
    renewalHeight: 343900
  });

  assert.equal(name.status, 'auction-reveal-leading');
  assert.equal(name.ownershipFinal, false);
  assert.equal(name.expires, '');
  assert.equal(name.expirationHeight, '');
});

test('registered owned names retain their renewal expiration', () => {
  const name = normalizeBridgeName({
    name: 'example',
    status: 'owned',
    ownershipFinal: true,
    renewalHeight: 343900
  });

  assert.equal(name.ownershipFinal, true);
  assert.equal(name.expirationHeight, 449020);
});

test('older bridge owned records remain compatible', () => {
  assert.equal(isFinalOwnership({status: 'owned'}), true);
  assert.equal(isFinalOwnership({status: 'auction-reveal-leading'}), false);
});
