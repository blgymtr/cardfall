'use strict';
// Steam "Rozetler" sayfasını okur: hangi oyunda kaç kart hakkı kaldı, kaç saat oynandı.

const cheerio = require('cheerio');
const http = require('./http');

const clean = (s) => String(s || '').replace(/[ \s]+/g, ' ').trim();

/**
 * @param {string} html
 * @returns {{games: Array<{appid:number,name:string,drops:number,hours:number,collected:number|null,total:number|null}>, pages:number}}
 */
function parseBadgesPage(html) {
  const $ = cheerio.load(html);
  const games = [];
  $('.badge_row').each((_, el) => {
    const row = $(el);
    const href = row.find('a.badge_row_overlay').attr('href') || '';
    const m = /\/gamecards\/(\d+)/.exec(href);
    if (!m) return; // oyun dışı rozet (topluluk, etkinlik vb.)
    const appid = Number(m[1]);
    if (!Number.isInteger(appid) || appid <= 0) return;

    const titleEl = row.find('.badge_title').first().clone();
    titleEl.find('.badge_view_details').remove();
    const name = clean(titleEl.text()) || `Uygulama ${appid}`;

    const text = clean(row.find('.badge_title_stats_content, .badge_title_stats').first().text() || row.text());
    const dm = /(\d+)\s+card\s+drops?\s+remaining/i.exec(text);
    const drops = dm ? Number(dm[1]) : 0;

    const hm = /([\d.,]+)\s*hrs?\s+on\s+record/i.exec(clean(row.find('.badge_title_stats_playtime').first().text()) || text);
    const hours = hm ? Number(hm[1].replace(/,/g, '')) || 0 : 0;

    const cm = /(\d+)\s+of\s+(\d+)\s+cards?\s+collected/i.exec(text);
    games.push({
      appid,
      name,
      drops,
      hours,
      collected: cm ? Number(cm[1]) : null,
      total: cm ? Number(cm[2]) : null,
    });
  });

  let pages = 1;
  $('.pagelink, .pagebtn').each((_, el) => {
    const n = Number(clean($(el).text()));
    if (Number.isInteger(n) && n > pages) pages = n;
  });
  return { games, pages: Math.min(pages, 40) };
}

async function fetchAllBadges({ steamid, cookies, onPage }) {
  const base = `https://steamcommunity.com/profiles/${encodeURIComponent(steamid)}/badges/?l=english`;
  const first = parseBadgesPage(await http.get(`${base}&p=1`, { cookies }));
  const byId = new Map(first.games.map((g) => [g.appid, g]));
  if (onPage) onPage(1, first.pages);
  for (let p = 2; p <= first.pages; p++) {
    await new Promise((r) => setTimeout(r, 900));
    const page = parseBadgesPage(await http.get(`${base}&p=${p}`, { cookies }));
    for (const g of page.games) byId.set(g.appid, g);
    if (onPage) onPage(p, first.pages);
  }
  if (byId.size === 0) throw new http.HttpError('EMPTY', 'Rozet sayfası okunamadı (oturum geçersiz olabilir)');
  return [...byId.values()];
}

module.exports = { parseBadgesPage, fetchAllBadges };
