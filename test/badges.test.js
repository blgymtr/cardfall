'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseBadgesPage } = require('../src/main/badges');

const row = (appid, name, drops, hours, extra = '') => `
<div class="badge_row is_link">
  <div class="badge_row_inner">
    <div class="badge_title_row">
      <div class="badge_title_stats">
        <div class="badge_title_stats_content">
          <div class="card_drop_info_dialog" id="card_drop_info_gamebadge_${appid}_1"></div>
          <div class="badge_title_stats_drops">
            <span class="progress_info_bold">${drops ? drops + ' card drops remaining' : ''}</span>
          </div>
          <div class="badge_title_stats_playtime">   ${hours}   </div>
        </div>
      </div>
      <div class="badge_title">${name}&nbsp;<span class="badge_view_details">View details</span></div>
    </div>
    ${extra}
  </div>
  <a class="badge_row_overlay" href="https://steamcommunity.com/id/me/gamecards/${appid}/"></a>
</div>`;

test('rozet sayfası: oyun, kart hakkı ve saat okunur', () => {
  const html = `<html><body>
  <div class="badge_details_set_favorite"></div>
  ${row(220, 'Half &amp; Half', 3, '12.4 hrs on record')}
  ${row(440, 'Team Thing', 0, '1,234.5 hrs on record')}
  ${row(570, 'Dota Like', 1, '')}
  <div class="badge_row is_link"><a class="badge_row_overlay" href="https://steamcommunity.com/id/me/badges/1/"></a><div class="badge_title">Topluluk rozeti</div></div>
  <div class="pageLinks"><a class="pagelink">1</a><a class="pagelink">2</a><a class="pagelink">3</a></div>
  </body></html>`;
  const r = parseBadgesPage(html);
  assert.strictEqual(r.games.length, 3);
  assert.deepStrictEqual(r.games.map((g) => g.appid), [220, 440, 570]);
  assert.strictEqual(r.games[0].name, 'Half & Half');
  assert.strictEqual(r.games[0].drops, 3);
  assert.strictEqual(r.games[0].hours, 12.4);
  assert.strictEqual(r.games[1].drops, 0);
  assert.strictEqual(r.games[1].hours, 1234.5);
  assert.strictEqual(r.games[2].hours, 0);
  assert.strictEqual(r.pages, 3);
});

test('bozuk/boş sayfa çökmez', () => {
  assert.deepStrictEqual(parseBadgesPage('<html></html>').games, []);
  assert.strictEqual(parseBadgesPage('').pages, 1);
});

test('ad içindeki HTML metin olarak kalır', () => {
  const r = parseBadgesPage(row(7, '&lt;img src=x onerror=alert(1)&gt;', 1, '1 hrs on record'));
  assert.strictEqual(r.games[0].name, '<img src=x onerror=alert(1)>');
});
