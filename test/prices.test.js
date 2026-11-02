'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseMoney, makeTemplate, formatMoney, averageCardPrice } = require('../src/main/prices');

test('parseMoney farklı biçimleri okur', () => {
  assert.strictEqual(parseMoney('$0.03'), 0.03);
  assert.strictEqual(parseMoney('₺3,50'), 3.5);
  assert.strictEqual(parseMoney('1.234,56 TL'), 1234.56);
  assert.strictEqual(parseMoney('€ 0,08'), 0.08);
  assert.strictEqual(parseMoney('R$ 0,05'), 0.05);
  assert.strictEqual(parseMoney('¥ 12'), 12);
  assert.strictEqual(parseMoney('yok'), null);
});

test('şablonla biçimlendirme aynı stili korur', () => {
  assert.strictEqual(formatMoney(makeTemplate('₺0,49'), 1234.5), '₺1.234,50');
  assert.strictEqual(formatMoney(makeTemplate('$0.03'), 1234.5), '$1,234.50');
  assert.strictEqual(formatMoney(makeTemplate('0,49₺'), 12), '12,00₺');
  assert.strictEqual(formatMoney(makeTemplate('₺0,49'), NaN), '—');
});

test('foil kartlar ve fiyatsızlar ortalamaya girmez', () => {
  const r = averageCardPrice([
    { hash_name: '753-A', sell_price: 10, sell_price_text: '$0.10' },
    { hash_name: '753-B', sell_price: 20, sell_price_text: '$0.20' },
    { hash_name: '753-C (Foil)', sell_price: 500, sell_price_text: '$5.00' },
    { hash_name: '753-D', sell_price: 0, sell_price_text: '' },
  ]);
  assert.strictEqual(r.count, 2);
  assert.ok(Math.abs(r.unit - 0.15) < 1e-9);
  assert.strictEqual(averageCardPrice([]), null);
});
