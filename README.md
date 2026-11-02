# Cardfall

Steam kart düşürme (idle) programı. Yalnızca kişisel kullanım içindir. Electron ile yapılmış bir Windows exe'sidir.

## Ne yapar

- Steam hesabına **QR kodla** bağlanır. Parolan hiç alınmaz.
- Rozet sayfandan kalan **kart hakkı** olan oyunları okur ve bunları "oynuyor" gösterir. Böylece kartlar düşer.
- Akıllı mod: 2 saatin altındaki oyunlar birlikte (en çok 32), sonra tek tek. Ayarlardan sabit sayı da seçilebilir.
- Duraklat / devam, sıradaki oyuna geç, belirli oyunu hemen çalıştır, oyunu sıradan gizle.
- Sayaçlar: çalışma süresi (bu oturum + toplam), kalan kart hakkı, sıradaki oyun sayısı, bu oturumda düşen kart ve tahmini değer.
- Yenile tuşu ve otomatik yenileme: rozetleri tekrar okur, düşen kartları sayar, sırayı günceller.
- Tahmini değer: Steam Pazarı'ndaki foil olmayan kartların ortalama fiyatı × kalan hak. Satışta net, Steam kesintisi (~%13) düşülerek gösterilir.
- Başka bir yerde oyun açılırsa (Steam'de ya da telefonda) bekler, boşalınca devam eder.

## Güvenlik

| Önlem | Ayrıntı |
|---|---|
| Parola yok, QR var | Steam parolası bu uygulamaya hiç girilmez |
| Şifreli kasa | Steam yenileme anahtarı parolandan türetilen AES-256-GCM anahtarıyla (scrypt N=2^16) şifrelenir, üstüne Windows DPAPI uygulanır |
| Deneme sınırı | 3. yanlıştan sonra bekleme üstel artar, 10. yanlışta kasa silinir |
| Otomatik kilit | Hareketsizlikte, Windows kilitlenince, uyku ve tepsiye küçültmede arayüz kilitlenir. Çalışma sürer |
| Kilitliyken veri yok | Kilitli arayüze oyun listesi ya da hesap bilgisi gönderilmez |
| İzole arayüz | `contextIsolation`, `sandbox`, Node yok, katı CSP (`connect-src 'none'`), arayüz internete çıkamaz |
| Dar IPC | Yalnızca kendi sayfamızdan gelen, doğrulanmış çağrılar kabul edilir |
| Ağ izin listesi | Ana süreç yalnızca `steamcommunity.com`, `api.steampowered.com`, Steam CDN'ine https ile gider |
| Electron fuse'ları | `RunAsNode` kapalı, `--inspect` kapalı, yalnızca asar'dan yükleme, asar bütünlük denetimi |
| Gizlilik | Telemetri, reklam, açık port, dış sunucu yok |

## Kullanım

```bash
npm install
npm run demo     # Steam'e bağlanmadan sahte verilerle arayüzü dener
npm test         # birim testleri
npm run dist     # release/Cardfall-Setup-1.0.0.exe üretir
```

İlk açılışta bir parola belirlersin, sonra QR ile Steam'e girersin. Sonraki açılışlarda yalnızca parolayı girersin.

## Bilmen gerekenler

- Aynı Steam hesabıyla bu bilgisayarda oyun açarsan Steam "başka yerde oynuyor" diye sorar. Cardfall o sırada bekler.
- Kart düşme zamanı Steam tarafından belirlenir. Programın sürdüğü süre içinde rastgele aralıklarla düşer.
- Gerçek Steam girişi QR kodu telefondan onaylamayı gerektirir. Demo modu bu adımı sahteler.
