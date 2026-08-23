(function exposeCoinBalances(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }

  root.hnsCoinBalances = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createCoinBalances() {
  function amount(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function freeConfirmedHns(wallet) {
    return Math.max(amount(wallet.confirmedHns) - amount(wallet.lockedConfirmedHns), 0);
  }

  function currentLockedHns(wallet) {
    return amount(wallet.lockedUnconfirmedHns);
  }

  function coinTotals(wallets) {
    return (wallets || []).reduce((totals, wallet) => ({
      spendableHns: totals.spendableHns + amount(wallet.spendableHns),
      confirmedHns: totals.confirmedHns + amount(wallet.confirmedHns),
      currentBalanceHns: totals.currentBalanceHns + amount(wallet.unconfirmedHns),
      currentLockedHns: totals.currentLockedHns + currentLockedHns(wallet),
    }), {
      spendableHns: 0,
      confirmedHns: 0,
      currentBalanceHns: 0,
      currentLockedHns: 0,
    });
  }

  return {coinTotals, currentLockedHns, freeConfirmedHns};
}));
