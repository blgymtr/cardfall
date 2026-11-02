<div align="center">

<img src="build/icon.png" width="96" alt="Cardfall simgesi">

# Cardfall

**Windows için sakin ve güvenli bir Steam kart düşürme programı.**
QR kodla giriş yap, oyunların "oynuyor" görünsün, kartların düşüşünü izle.

[![CI](https://github.com/blgymtr/cardfall/actions/workflows/ci.yml/badge.svg)](https://github.com/blgymtr/cardfall/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/blgymtr/cardfall)](https://github.com/blgymtr/cardfall/releases/latest)
[![Lisans: MIT](https://img.shields.io/badge/lisans-MIT-green.svg)](LICENSE)

[English](README.md) · [Deutsch](README.de.md) · **Türkçe**

<img src="docs/screenshots/app-dark.png" alt="Cardfall ana penceresi (demo verisi)" width="860">

<sub>Ekran görüntüleri yerleşik demo verisiyle alınmıştır (İngilizce arayüz).</sub>

</div>

## İndir

Kurulum dosyasını [son sürümden](https://github.com/blgymtr/cardfall/releases/latest) indir
(`Cardfall-Setup-<sürüm>.exe`, Windows 10/11, 64 bit). Kurulum dosyası **imzasız** olduğu için Windows SmartScreen ilk açılışta uyarı
verebilir ("Ek bilgi" → "Yine de çalıştır"). İstersen sürüm sayfasındaki SHA-256 sağlama toplamını karşılaştırabilirsin.

## Özellikler

- **QR ile giriş.** Steam parolan Cardfall'a hiç girilmez, saklanmaz.
- **Akıllı çalışma.** 2 saatin altındaki oyunlar birlikte (en çok 32), sonra tek tek çalışır. İstersen sabit 1 ile 32 oyun seçebilirsin.
- **Tam kontrol.** Duraklat ve devam et, sıradaki oyuna geç, belirli bir oyunu hemen çalıştır, oyunları sıradan gizle.
- **Canlı sayılar.** Çalışma süresi (oturum ve toplam), kalan kart hakkı, sıradaki oyun sayısı, bu oturumda düşen kart ve
  Steam Pazarı'ndan tahmini değer (Steam kesintisi düşülmüş net).
- **Yenile tuşu** ve rozetleri yeniden okuyup yeni düşenleri sayan otomatik yenileme.
- **Steam ile uyumlu.** Hesabında başka yerde oyun açarsan Cardfall bekler, boşalınca devam eder.
- **Açık ve koyu tema**, **Türkçe, İngilizce ve Almanca** arayüz (sistem dilini izler, istediğin zaman değiştirilir).
- **Tepsi modu.** Çalışırken pencereyi kapatırsan arka planda sürer ve arayüz kilitlenir.

## Güvenlik

| Önlem | Ayrıntı |
|---|---|
| Parola yok, QR var | Steam parolan uygulamaya hiç girmez |
| Şifreli kasa | Steam yenileme anahtarı, parolandan türetilen anahtarla (scrypt, N=2^16) AES-256-GCM ile şifrelenir ve ayrıca Windows DPAPI ile sarılır |
| Deneme sınırı | 3 yanlıştan sonra bekleme üstel artar, 10 yanlışta kasa silinir |
| Otomatik kilit | Hareketsizlikte, Windows kilitlenince, uykuya geçince ve tepsiye küçülünce. Kilitliyken çalışma sürer |
| Kilitliyken veri yok | Kilitli arayüze oyun listesi ya da hesap bilgisi gönderilmez |
| İzole arayüz | `contextIsolation`, sandbox, Node yok, `connect-src 'none'` ile katı CSP, arayüz internete çıkamaz |
| Dar IPC | Yalnızca uygulamanın kendi sayfasından gelen, doğrulanmış çağrılar kabul edilir |
| Ağ izin listesi | Yalnızca HTTPS ile `steamcommunity.com`, `api.steampowered.com` ve Steam CDN |
| Sertleştirilmiş Electron | `RunAsNode` ve `--inspect` kapalı, yalnızca asar'dan yükleme, asar bütünlük denetimi |
| Gizlilik | Telemetri, reklam, güncelleme sorgusu, açık port yok |

Tehdit modeli ve bildirim yolu için [güvenlik politikasına](SECURITY.md) (İngilizce) bak.

## Başlarken

1. Cardfall'ı kur ve aç.
2. Bir parola belirle. Bu parola, bu bilgisayardaki kayıtlı Steam oturumunu korur.
3. Telefondaki Steam uygulamasında **Steam Guard**'ı aç, Cardfall'ın gösterdiği QR kodu okut ve onayla.
4. Cardfall rozetlerini okur ve çalışmaya başlar. Hepsi bu.

<details>
<summary>Daha fazla ekran görüntüsü</summary>

<img src="docs/screenshots/app-light.png" alt="Açık tema" width="720">
<img src="docs/screenshots/login.png" alt="QR ile giriş" width="720">
<img src="docs/screenshots/settings.png" alt="Ayarlar" width="720">

</details>

## Bilmen gerekenler

- Steam, bir oyunda yaklaşık **2 saat** oynamadan kart düşürmez. Yeni oyunlar bu yüzden daha geç düşürmeye başlar.
- Kartlar rastgele düşer ve zamanı Steam belirler. Cardfall oyunlarını "oyunda" tutar, kartın ne zaman çıkacağını kontrol etmez.
- Aynı bilgisayarda bir oyun açarsan Steam diğer oturumu kapatmak ister. Cardfall bunu algılar ve bekler.
- Tahmini değerler Steam Pazarı'ndaki güncel ilanlardan gelir, yalnızca kaba bir fikir verir. Pazar istekleri sınırladığı için fiyatlar yavaş alınır.
- Verilerin `%APPDATA%\Cardfall` klasöründe durur. **Ayarlar → Tüm yerel verileri sil** her şeyi kaldırır.

## Sorumluluk reddi

Cardfall bağımsız bir hobi projesidir. Valve Corporation ile bağlantısı yoktur, Valve tarafından onaylanmamış ya da desteklenmemiştir.
Steam ve Steam logosu Valve Corporation'ın ticari markalarıdır. Kart toplamak için oyun "idle" etmek yaygın bir uygulamadır,
ancak yazılımı kendi sorumluluğunda kullanırsın ve Steam Abone Sözleşmesi'ne uymaktan sen sorumlusun.

## Geliştirme

```bash
npm install        # gerekirse: node node_modules/electron/install.js
npm run demo       # Steam'e bağlanmadan sahte verilerle arayüzü aç
npm test           # birim testleri
npm run dist       # release/Cardfall-Setup-<sürüm>.exe üret
```

Yapı: `src/main` (kasa, Steam oturumu, motor, güvenlik), `src/preload` (IPC köprüsü),
`src/renderer` (arayüz ve `i18n.js` içindeki çeviriler). Yeni dil eklemek için `src/renderer/i18n.js` dosyasına bir sütun eklemek yeterlidir.
Issue ve pull request'ler memnuniyetle karşılanır.

## Lisans

[MIT](LICENSE) © 2026 Ömer
