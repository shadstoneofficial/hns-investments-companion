const assert = require('node:assert/strict');
const test = require('node:test');
const {
  coinTotals,
  currentLockedHns,
  freeConfirmedHns,
} = require('../src/renderer/coinBalances');

test('coin totals keep spendable, confirmed, and current locked balances distinct', () => {
  const wallets = [{
    confirmedHns: 13228324.61,
    unconfirmedHns: 13228324.61,
    lockedConfirmedHns: 1315105.55,
    lockedUnconfirmedHns: 1315105.55,
    spendableHns: 11913219.06,
  }, {
    confirmedHns: 100,
    unconfirmedHns: 90,
    lockedConfirmedHns: 20,
    lockedUnconfirmedHns: 10,
    spendableHns: 80,
  }];

  assert.deepEqual(coinTotals(wallets), {
    spendableHns: 11913299.06,
    confirmedHns: 13228424.61,
    currentBalanceHns: 13228414.61,
    currentLockedHns: 1315115.55,
  });
});

test('current locked does not double count confirmed and unconfirmed views', () => {
  const wallet = {
    confirmedHns: 100,
    lockedConfirmedHns: 20,
    lockedUnconfirmedHns: 25,
  };

  assert.equal(freeConfirmedHns(wallet), 80);
  assert.equal(currentLockedHns(wallet), 25);
});
