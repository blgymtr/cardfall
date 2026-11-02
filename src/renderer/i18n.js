'use strict';
// Çeviriler: hem ana süreç (require) hem arayüz (<script>) kullanır.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.I18N = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const LANGS = ['tr', 'en', 'de'];
  const NAMES = { tr: 'Türkçe', en: 'English', de: 'Deutsch' };
  const LOCALES = { tr: 'tr-TR', en: 'en-US', de: 'de-DE' };
  const CONFIRM_WORD = { tr: 'SIL', en: 'DELETE', de: 'LÖSCHEN' };

  const D = { tr: {}, en: {}, de: {} };
  // [anahtar, Türkçe, English, Deutsch]. "a|b" = tekil|çoğul (n === 1 ise ilki).
  const rows = [
    // ---- genel / başlık çubuğu
    ['tb.settings', 'Ayarlar', 'Settings', 'Einstellungen'],
    ['tb.lock', 'Kilitle', 'Lock', 'Sperren'],
    ['tb.lang', 'Dil', 'Language', 'Sprache'],

    // ---- parola kuralları
    ['pw.short', 'Parola en az 8 karakter olmalı.', 'The passphrase must be at least 8 characters.', 'Die Passphrase muss mindestens 8 Zeichen lang sein.'],
    ['pw.long', 'Parola en fazla 128 karakter olabilir.', 'The passphrase can be at most 128 characters.', 'Die Passphrase darf höchstens 128 Zeichen lang sein.'],
    ['pw.common', 'Bu parola çok yaygın, başka bir tane seç.', 'This passphrase is too common, pick another one.', 'Diese Passphrase ist zu gebräuchlich, wähle eine andere.'],
    ['pw.same', 'Parola tek karakterden oluşamaz.', 'The passphrase cannot be a single repeated character.', 'Die Passphrase darf nicht nur aus einem Zeichen bestehen.'],
    ['pw.weak', 'Kısa parolada en az iki tür karakter kullan (harf + rakam gibi) ya da 12+ karakter yaz.', 'For a short passphrase use at least two kinds of characters (letters + digits) or write 12+ characters.', 'Bei kurzen Passphrasen mindestens zwei Zeichenarten (Buchstaben + Ziffern) oder 12+ Zeichen verwenden.'],
    ['pw.invalid', 'Geçersiz parola.', 'Invalid passphrase.', 'Ungültige Passphrase.'],
    ['msg.vaultExists', 'Kasa zaten kurulu.', 'The vault is already set up.', 'Der Tresor ist bereits eingerichtet.'],

    // ---- kilit / kurulum ekranı
    ['gate.setupSub', 'İlk kurulum — Steam oturum anahtarını koruyacak bir parola belirle.', 'First setup — choose a passphrase that protects your Steam session key.', 'Ersteinrichtung — wähle eine Passphrase, die deinen Steam-Sitzungsschlüssel schützt.'],
    ['gate.lockedSub', 'Kilitli. Devam etmek için parolanı gir.', 'Locked. Enter your passphrase to continue.', 'Gesperrt. Gib deine Passphrase ein, um fortzufahren.'],
    ['gate.passNew', 'Yeni parola (en az 8 karakter)', 'New passphrase (at least 8 characters)', 'Neue Passphrase (mindestens 8 Zeichen)'],
    ['gate.pass', 'Parola', 'Passphrase', 'Passphrase'],
    ['gate.passRepeat', 'Parolayı tekrar yaz', 'Repeat the passphrase', 'Passphrase wiederholen'],
    ['gate.create', 'Parolayı oluştur', 'Create passphrase', 'Passphrase erstellen'],
    ['gate.unlock', 'Kilidi aç', 'Unlock', 'Entsperren'],
    ['gate.fineSetup', 'Parola yalnızca bu bilgisayarda kalır, hiçbir yere gönderilmez. Unutursan kayıtlı Steam oturumu silinir ve QR ile yeniden giriş yaparsın.', 'The passphrase stays on this computer and is never sent anywhere. If you forget it, the saved Steam session is deleted and you sign in again with a QR code.', 'Die Passphrase bleibt auf diesem Computer und wird nirgends hingesendet. Vergisst du sie, wird die gespeicherte Steam-Sitzung gelöscht und du meldest dich erneut per QR-Code an.'],
    ['gate.fineLocked', 'Yanlış parola denemeleri yavaşlatılır; 10 hatada kayıtlı oturum silinir.', 'Wrong attempts are slowed down; after 10 failures the saved session is deleted.', 'Falsche Eingaben werden gebremst; nach 10 Fehlversuchen wird die gespeicherte Sitzung gelöscht.'],
    ['gate.mismatch', 'Parolalar aynı değil.', 'The passphrases do not match.', 'Die Passphrasen stimmen nicht überein.'],
    ['gate.setupFail', 'Kurulum başarısız.', 'Setup failed.', 'Einrichtung fehlgeschlagen.'],
    ['gate.attemptsLeft', 'Kalan deneme: {n}', 'Attempts left: {n}', 'Verbleibende Versuche: {n}'],
    ['gate.wrong', 'Parola yanlış. Kalan deneme: {n}', 'Wrong passphrase. Attempts left: {n}', 'Falsche Passphrase. Verbleibende Versuche: {n}'],
    ['gate.tooMany', 'Çok fazla deneme. Bekle…', 'Too many attempts. Please wait…', 'Zu viele Versuche. Bitte warten…'],
    ['gate.wait', 'Çok fazla yanlış deneme — {s} sn bekle', 'Too many wrong attempts — wait {s} s', 'Zu viele Fehlversuche — warte {s} s'],
    ['gate.wiped', 'Kayıtlı oturum silindi.', 'The saved session was deleted.', 'Die gespeicherte Sitzung wurde gelöscht.'],
    ['gate.corrupt', 'Kasa okunamadı (farklı Windows hesabı olabilir).', 'The vault could not be read (maybe a different Windows account).', 'Der Tresor konnte nicht gelesen werden (evtl. anderes Windows-Konto).'],
    ['gate.busy', 'Bir saniye…', 'One moment…', 'Einen Moment…'],
    ['gate.fail', 'İşlem başarısız.', 'The operation failed.', 'Vorgang fehlgeschlagen.'],
    ['gate.forgot', 'Parolamı unuttum', 'I forgot my passphrase', 'Passphrase vergessen'],
    ['forgot.title', 'Parolayı unuttum', 'Forgot the passphrase', 'Passphrase vergessen'],
    ['forgot.text', 'Parola kurtarılamaz. Devam edersen kayıtlı Steam oturumu ve tüm yerel veriler silinir; sonra yeni parola ve QR ile baştan kurarsın.', 'The passphrase cannot be recovered. If you continue, the saved Steam session and all local data are deleted; you then set up again with a new passphrase and a QR code.', 'Die Passphrase kann nicht wiederhergestellt werden. Wenn du fortfährst, werden die gespeicherte Steam-Sitzung und alle lokalen Daten gelöscht; danach richtest du alles mit neuer Passphrase und QR-Code neu ein.'],
    ['forgot.ok', 'Her şeyi sil', 'Delete everything', 'Alles löschen'],

    // ---- giriş (QR)
    ['login.title', 'Steam hesabına bağlan', 'Connect your Steam account', 'Steam-Konto verbinden'],
    ['login.lead', 'Parolanı bu uygulamaya girmene gerek yok. Telefonundaki Steam uygulamasıyla QR kodu okut.', 'You do not enter your password in this app. Scan the QR code with the Steam app on your phone.', 'Du gibst dein Passwort nicht in dieser App ein. Scanne den QR-Code mit der Steam-App auf deinem Handy.'],
    ['login.s1', 'Telefonunda Steam uygulamasını aç.', 'Open the Steam app on your phone.', 'Öffne die Steam-App auf deinem Handy.'],
    ['login.s2', 'Steam Guard bölümünden QR kodu tara seçeneğini seç.', 'In the Steam Guard section choose the option to scan a QR code.', 'Wähle im Bereich Steam Guard die Option zum Scannen eines QR-Codes.'],
    ['login.s3', 'Soldaki kodu okut ve girişi onayla.', 'Scan the code on the left and approve the sign-in.', 'Scanne den Code links und bestätige die Anmeldung.'],
    ['login.shield', "Steam parolan hiç alınmaz. Yalnızca Steam'in verdiği yenileme anahtarı, kasa parolanla şifrelenip bu bilgisayarda saklanır.", 'Your Steam password is never collected. Only the refresh key issued by Steam is encrypted with your vault passphrase and stored on this computer.', 'Dein Steam-Passwort wird nie erfasst. Nur der von Steam ausgestellte Erneuerungsschlüssel wird mit deiner Tresor-Passphrase verschlüsselt und auf diesem Computer gespeichert.'],
    ['qr.alt', 'Steam giriş QR kodu', 'Steam sign-in QR code', 'Steam-Anmelde-QR-Code'],
    ['qr.preparing', 'QR hazırlanıyor…', 'Preparing QR…', 'QR wird vorbereitet…'],
    ['qr.scanned', 'Okutuldu — telefonda onayla', 'Scanned — approve on your phone', 'Gescannt — am Handy bestätigen'],
    ['qr.expired', 'Süresi doldu, yenileniyor…', 'Expired, refreshing…', 'Abgelaufen, wird erneuert…'],
    ['qr.retry', 'Tekrar dene', 'Try again', 'Erneut versuchen'],
    ['qr.errFail', 'Giriş başarısız oldu, tekrar dene.', 'Sign-in failed, please try again.', 'Anmeldung fehlgeschlagen, bitte erneut versuchen.'],
    ['qr.errImage', 'QR oluşturulamadı', 'Could not create the QR code', 'QR-Code konnte nicht erstellt werden'],
    ['qr.generic', 'Bir sorun oluştu', 'Something went wrong', 'Etwas ist schiefgelaufen'],
    ['conn.title', "Steam'e bağlanılıyor", 'Connecting to Steam', 'Verbindung zu Steam wird hergestellt'],
    ['conn.problem', 'Bağlantı sorunu: {reason}. Otomatik yeniden denenecek.', 'Connection problem: {reason}. Retrying automatically.', 'Verbindungsproblem: {reason}. Automatischer neuer Versuch.'],
    ['conn.account', '{name} hesabı', 'Account {name}', 'Konto {name}'],
    ['conn.wait', 'Lütfen bekle…', 'Please wait…', 'Bitte warten…'],

    // ---- bildirimler / notlar
    ['notice.expired', 'Steam oturumu sona erdi. QR kodla yeniden giriş yap.', 'The Steam session has ended. Sign in again with a QR code.', 'Die Steam-Sitzung ist beendet. Melde dich erneut per QR-Code an.'],
    ['notice.loggedOut', 'Oturum kapatıldı, kayıtlı Steam anahtarı silindi.', 'Signed out, the saved Steam key was deleted.', 'Abgemeldet, der gespeicherte Steam-Schlüssel wurde gelöscht.'],
    ['notice.tooMany', 'Çok fazla yanlış deneme: kayıtlı oturum silindi. Yeni bir parola oluştur.', 'Too many wrong attempts: the saved session was deleted. Create a new passphrase.', 'Zu viele Fehlversuche: Die gespeicherte Sitzung wurde gelöscht. Erstelle eine neue Passphrase.'],
    ['notice.wiped', 'Tüm yerel veriler silindi.', 'All local data was deleted.', 'Alle lokalen Daten wurden gelöscht.'],

    // ---- etkinlik günlüğü
    ['log.started', 'Başlatıldı', 'Started', 'Gestartet'],
    ['log.paused', 'Duraklatıldı', 'Paused', 'Pausiert'],
    ['log.play', '{names} çalışıyor', '{names} running', '{names} läuft'],
    ['log.playMore', '{names} ve {n} oyun daha çalışıyor', '{names} and {n} more running', '{names} und {n} weitere laufen'],
    ['log.pinned', 'Elle seçildi: {name}', 'Picked manually: {name}', 'Manuell gewählt: {name}'],
    ['log.unpinned', 'Otomatik sıraya dönüldü', 'Back to automatic order', 'Zurück zur automatischen Reihenfolge'],
    ['log.refreshed', 'Yenilendi · {n} kart hakkı', 'Refreshed · {n} card drops', 'Aktualisiert · {n} Kartendrops'],
    ['log.refreshFailed', 'Yenileme başarısız: {reason}', 'Refresh failed: {reason}', 'Aktualisierung fehlgeschlagen: {reason}'],
    ['log.drop', '{name}: +{n} kart düştü', '{name}: +{n} card dropped', '{name}: +{n} Karte gefallen'],
    ['log.dropDone', '{name}: +{n} kart düştü (tamamlandı)', '{name}: +{n} card dropped (finished)', '{name}: +{n} Karte gefallen (fertig)'],
    ['log.queued', '{n} oyun sırada', '{n} games queued', '{n} Spiele in der Warteschlange'],
    ['log.blocked', 'Steam hesabında başka yerde oyun açık — bekleniyor', 'A game is running elsewhere on your account — waiting', 'Auf deinem Konto läuft anderswo ein Spiel — warte'],
    ['log.unblocked', 'Hesap boşa çıktı, devam ediliyor', 'The account is free again, resuming', 'Das Konto ist wieder frei, es geht weiter'],
    ['log.connError', 'Bağlantı hatası: {reason}', 'Connection error: {reason}', 'Verbindungsfehler: {reason}'],

    // ---- ana ekran: durum
    ['st.offline', 'Çevrimdışı', 'Offline', 'Offline'],
    ['st.waiting', 'Beklemede', 'On hold', 'Wartend'],
    ['st.done', 'Tamamlandı', 'Finished', 'Fertig'],
    ['st.running', 'Çalışıyor', 'Running', 'Läuft'],
    ['st.preparing', 'Hazırlanıyor', 'Preparing', 'Wird vorbereitet'],
    ['st.paused', 'Duraklatıldı', 'Paused', 'Pausiert'],
    ['st.ready', 'Hazır', 'Ready', 'Bereit'],
    ['pill.offline', 'Bağlantı yok', 'No connection', 'Keine Verbindung'],
    ['pill.pinned', 'Elle seçildi', 'Picked manually', 'Manuell gewählt'],
    ['hs.offline.title', 'Bağlantı bekleniyor', 'Waiting for connection', 'Warte auf Verbindung'],
    ['hs.offline.sub', 'Steam bağlantısı kesildi, otomatik yeniden denenecek.', 'The Steam connection dropped, retrying automatically.', 'Die Steam-Verbindung wurde getrennt, es wird automatisch erneut versucht.'],
    ['hs.blocked.title', "Steam'de başka oyun açık", 'Another game is running on Steam', 'Auf Steam läuft ein anderes Spiel'],
    ['hs.blocked.sub', 'Hesabında başka bir yerde oyun oynanıyor. Kapanınca otomatik devam eder.', 'A game is being played elsewhere on your account. It resumes automatically once it closes.', 'Auf deinem Konto wird anderswo gespielt. Es geht automatisch weiter, sobald das Spiel beendet ist.'],
    ['hs.done.title', 'Tüm kartlar düştü', 'All cards have dropped', 'Alle Karten sind gefallen'],
    ['hs.done.sub', 'Sırada kart hakkı olan oyun kalmadı.', 'No games with card drops left in the queue.', 'Keine Spiele mit Kartendrops mehr in der Warteschlange.'],
    ['hs.prep.title', 'Kuyruk hazırlanıyor', 'Preparing the queue', 'Warteschlange wird vorbereitet'],
    ['hs.prep.sub', 'Rozetler okunuyor…', 'Reading badges…', 'Abzeichen werden gelesen…'],
    ['hs.paused.sub', "Devam et'e basınca kaldığın yerden sürer. Hesabın oyun oynuyor görünmez.", 'Press Resume to continue where you left off. Your account does not appear to be playing.', 'Mit „Fortsetzen“ geht es weiter. Dein Konto erscheint nicht als spielend.'],
    ['hs.ready.title', 'Hazır', 'Ready', 'Bereit'],
    ['hs.ready.sub', '{n} kart hakkı seni bekliyor.', '{n} card drops are waiting for you.', '{n} Kartendrops warten auf dich.'],
    ['hero.one.sub', '{drops} kart hakkı kaldı · {hours} saat oynama', '{drops} card drops left · {hours} h played', 'Noch {drops} Kartendrops · {hours} Std. gespielt'],
    ['hero.many.title', '{n} oyun eşzamanlı çalışıyor', '{n} games running at once', '{n} Spiele laufen gleichzeitig'],
    ['hero.many.sub', 'Toplam {n} kart hakkı bu oyunlarda', '{n} card drops in total across these games', 'Insgesamt {n} Kartendrops in diesen Spielen'],
    ['btn.pause', 'Duraklat', 'Pause', 'Pausieren'],
    ['btn.resume', 'Devam et', 'Resume', 'Fortsetzen'],
    ['btn.start', 'Başlat', 'Start', 'Starten'],
    ['btn.next', 'Sıradaki oyun', 'Next game', 'Nächstes Spiel'],
    ['btn.auto', 'Otomatiğe dön', 'Back to auto', 'Zurück zu Auto'],
    ['btn.refresh', 'Yenile', 'Refresh', 'Aktualisieren'],

    // ---- ana ekran: sayaçlar
    ['ov.title', 'Genel bakış', 'Overview', 'Übersicht'],
    ['ov.last', 'Son yenileme {time}', 'Last refresh {time}', 'Zuletzt aktualisiert {time}'],
    ['ov.reading', 'Okunuyor…', 'Reading…', 'Wird gelesen…'],
    ['s.uptime', 'Çalışma süresi', 'Running time', 'Laufzeit'],
    ['s.uptimeSub', 'toplam {t}', 'total {t}', 'gesamt {t}'],
    ['s.drops', 'Kalan kart hakkı', 'Card drops left', 'Verbleibende Kartendrops'],
    ['s.dropsSub', '{n} oyunda', 'in {n} game|in {n} games', 'in {n} Spiel|in {n} Spielen'],
    ['s.dropsDone', ' · {n} oyun tamam', ' · {n} finished', ' · {n} fertig'],
    ['s.queue', 'Sırada', 'In queue', 'In der Warteschlange'],
    ['s.queueSub', '{n} oyun şu an çalışıyor', '{n} running now', '{n} laufen gerade'],
    ['s.queueNone', 'şu an çalışan yok', 'nothing running now', 'gerade läuft nichts'],
    ['s.got', 'Bu oturumda düşen', 'Dropped this session', 'In dieser Sitzung gefallen'],
    ['s.gotNone', 'henüz kart düşmedi', 'no cards dropped yet', 'noch keine Karte gefallen'],
    ['s.value', 'Tahmini değer', 'Estimated value', 'Geschätzter Wert'],
    ['s.valueSub', 'net ≈ {net} · {p}/{g} fiyatlı', 'net ≈ {net} · {p}/{g} priced', 'netto ≈ {net} · {p}/{g} mit Preis'],
    ['s.valuePrices', 'fiyatlar alınıyor ({d}/{t})', 'fetching prices ({d}/{t})', 'Preise werden geladen ({d}/{t})'],
    ['s.valueWait', 'fiyatlar bekleniyor', 'waiting for prices', 'warte auf Preise'],
    ['toast.drop', 'Kart düştü · bu oturumda {n}', 'Card dropped · {n} this session', 'Karte gefallen · {n} in dieser Sitzung'],

    // ---- sıra
    ['queue.title', 'Sıra', 'Queue', 'Warteschlange'],
    ['queue.search', 'Oyun ara…', 'Search games…', 'Spiele suchen…'],
    ['queue.count', '{n} oyun', '{n} game|{n} games', '{n} Spiel|{n} Spiele'],
    ['queue.countHidden', '{n} gizli oyun', '{n} hidden game|{n} hidden games', '{n} ausgeblendetes Spiel|{n} ausgeblendete Spiele'],
    ['queue.showHidden', 'Gizlenen oyunlar ({n})', 'Hidden games ({n})', 'Ausgeblendete Spiele ({n})'],
    ['queue.back', 'Sıraya dön', 'Back to queue', 'Zurück zur Warteschlange'],
    ['queue.emptyHidden', 'Gizlenmiş oyun yok.', 'No hidden games.', 'Keine ausgeblendeten Spiele.'],
    ['queue.emptySearch', 'Eşleşen oyun yok.', 'No matching games.', 'Keine passenden Spiele.'],
    ['queue.empty', 'Sırada kart hakkı olan oyun yok.', 'No games with card drops in the queue.', 'Keine Spiele mit Kartendrops in der Warteschlange.'],
    ['ord.drops-desc', 'En çok kart', 'Most cards', 'Meiste Karten'],
    ['ord.value-desc', 'En değerli', 'Most valuable', 'Wertvollste'],
    ['ord.hours-asc', 'En az saat', 'Fewest hours', 'Wenigste Stunden'],
    ['ord.name', 'Ada göre', 'By name', 'Nach Name'],
    ['row.hours', '{h} saat oynama', '{h} h played', '{h} Std. gespielt'],
    ['row.card', ' · kart ≈ {p}', ' · card ≈ {p}', ' · Karte ≈ {p}'],
    ['row.live', 'Çalışıyor', 'Running', 'Läuft'],
    ['row.runNow', 'Şimdi bunu çalıştır', 'Run this one now', 'Dieses jetzt starten'],
    ['row.toAuto', 'Otomatiğe dön', 'Back to auto', 'Zurück zu Auto'],
    ['row.hide', 'Sıradan gizle', 'Hide from queue', 'In der Warteschlange ausblenden'],
    ['row.unhide', 'Sıraya geri al', 'Put back in queue', 'Wieder einreihen'],
    ['row.drops', 'Kalan kart hakkı', 'Card drops left', 'Verbleibende Kartendrops'],
    ['price.note', "Kart fiyatları Steam Pazarı'ndan alınıyor ({d}/{t}) — hız sınırı yüzünden yavaş.", 'Card prices are being fetched from the Steam Market ({d}/{t}) — slow because of rate limits.', 'Kartenpreise werden vom Steam-Marktplatz geladen ({d}/{t}) — langsam wegen Abrufbegrenzung.'],
    ['side.activity', 'Etkinlik', 'Activity', 'Aktivität'],
    ['side.none', 'Henüz etkinlik yok', 'No activity yet', 'Noch keine Aktivität'],
    ['side.totals', 'Toplamlar', 'Totals', 'Gesamtwerte'],
    ['tot.time', 'Toplam çalışma', 'Total running time', 'Gesamtlaufzeit'],
    ['tot.cards', 'Toplam düşen kart', 'Total cards dropped', 'Gefallene Karten gesamt'],
    ['tot.value', 'Tahmini kazanç', 'Estimated earnings', 'Geschätzter Ertrag'],
    ['tot.account', 'Hesap', 'Account', 'Konto'],
    ['dur.min', '{n} dk', '{n} min', '{n} Min.'],
    ['dur.hm', '{h} sa {m} dk', '{h} h {m} min', '{h} Std. {m} Min.'],
    ['dur.h', '{h} sa', '{h} h', '{h} Std.'],

    // ---- ayarlar
    ['set.title', 'Ayarlar', 'Settings', 'Einstellungen'],
    ['set.appearance', 'Görünüm', 'Appearance', 'Darstellung'],
    ['set.theme', 'Tema', 'Theme', 'Design'],
    ['theme.system', 'Sistem', 'System', 'System'],
    ['theme.dark', 'Koyu', 'Dark', 'Dunkel'],
    ['theme.light', 'Açık', 'Light', 'Hell'],
    ['set.language', 'Dil', 'Language', 'Sprache'],
    ['lang.auto', 'Otomatik', 'Automatic', 'Automatisch'],
    ['set.work', 'Çalışma', 'Running', 'Betrieb'],
    ['set.concurrency', 'Eşzamanlı oyun', 'Games at once', 'Gleichzeitige Spiele'],
    ['set.concurrencyHint', 'Akıllı: 2 saatin altındakiler birlikte, sonra tek tek.', 'Smart: games under 2 hours together, then one at a time.', 'Smart: Spiele unter 2 Stunden gemeinsam, danach einzeln.'],
    ['conc.smart', 'Akıllı (önerilen)', 'Smart (recommended)', 'Smart (empfohlen)'],
    ['conc.n', '{n} oyun', '{n} game|{n} games', '{n} Spiel|{n} Spiele'],
    ['set.order', 'Kuyruk sırası', 'Queue order', 'Reihenfolge'],
    ['set.refresh', 'Otomatik yenileme', 'Automatic refresh', 'Automatische Aktualisierung'],
    ['set.refreshHint', 'Rozetler bu aralıkla okunur.', 'Badges are re-read at this interval.', 'Abzeichen werden in diesem Intervall neu gelesen.'],
    ['min.n', '{n} dakika', '{n} minutes', '{n} Minuten'],
    ['set.autostart', 'Girişte otomatik başlat', 'Start automatically after sign-in', 'Nach der Anmeldung automatisch starten'],
    ['set.keepawake', 'Çalışırken bilgisayarı uyanık tut', 'Keep the computer awake while running', 'Computer im Betrieb wach halten'],
    ['set.tray', 'Pencereyi kapatınca tepsiye küçül', 'Minimize to tray when the window is closed', 'Beim Schließen in den Infobereich minimieren'],
    ['set.trayHint', 'Çalışırken kapatırsan arka planda sürer ve kilitlenir.', 'If you close it while running, it keeps going in the background and locks.', 'Wenn du es im Betrieb schließt, läuft es im Hintergrund weiter und sperrt sich.'],
    ['set.security', 'Güvenlik', 'Security', 'Sicherheit'],
    ['set.autolock', 'Otomatik kilit', 'Auto-lock', 'Automatische Sperre'],
    ['set.autolockHint', 'Hareketsiz kalınca arayüz parolayla kilitlenir.', 'The interface locks behind the passphrase when idle.', 'Die Oberfläche sperrt sich bei Inaktivität per Passphrase.'],
    ['lock.off', 'Kapalı', 'Off', 'Aus'],
    ['lock.hour', '1 saat', '1 hour', '1 Stunde'],
    ['set.passphrase', 'Kasa parolası', 'Vault passphrase', 'Tresor-Passphrase'],
    ['btn.change', 'Değiştir', 'Change', 'Ändern'],
    ['pw.old', 'Mevcut parola', 'Current passphrase', 'Aktuelle Passphrase'],
    ['pw.new', 'Yeni parola', 'New passphrase', 'Neue Passphrase'],
    ['pw.newRepeat', 'Yeni parola (tekrar)', 'New passphrase (repeat)', 'Neue Passphrase (wiederholen)'],
    ['pw.update', 'Parolayı güncelle', 'Update passphrase', 'Passphrase aktualisieren'],
    ['pw.mismatch', 'Yeni parolalar aynı değil.', 'The new passphrases do not match.', 'Die neuen Passphrasen stimmen nicht überein.'],
    ['pw.updated', 'Parola güncellendi', 'Passphrase updated', 'Passphrase aktualisiert'],
    ['pw.wrongOld', 'Mevcut parola yanlış (kalan: {n})', 'Current passphrase is wrong ({n} left)', 'Aktuelle Passphrase falsch ({n} übrig)'],
    ['pw.wait', 'Bir süre bekle.', 'Wait a moment.', 'Warte einen Moment.'],
    ['pw.fail', 'Başarısız.', 'Failed.', 'Fehlgeschlagen.'],
    ['set.logout', 'Steam oturumunu kapat', 'Sign out of Steam', 'Von Steam abmelden'],
    ['set.logoutHint', 'Kayıtlı Steam anahtarını siler; yeniden QR gerekir.', 'Deletes the saved Steam key; a new QR sign-in is needed.', 'Löscht den gespeicherten Steam-Schlüssel; ein neuer QR-Login ist nötig.'],
    ['btn.logout', 'Oturumu kapat', 'Sign out', 'Abmelden'],
    ['confirm.logout.title', 'Oturumu kapat', 'Sign out', 'Abmelden'],
    ['confirm.logout.text', 'Kayıtlı Steam anahtarı silinecek ve çalışma duracak. Tekrar QR ile giriş yapman gerekir.', 'The saved Steam key will be deleted and running will stop. You will need to sign in with a QR code again.', 'Der gespeicherte Steam-Schlüssel wird gelöscht und der Betrieb gestoppt. Du musst dich erneut per QR-Code anmelden.'],
    ['set.wipe', 'Tüm yerel verileri sil', 'Delete all local data', 'Alle lokalen Daten löschen'],
    ['set.wipeHint', 'Kasa, ayarlar, istatistik ve önbellek.', 'Vault, settings, statistics and cache.', 'Tresor, Einstellungen, Statistik und Cache.'],
    ['btn.wipeAll', 'Hepsini sil', 'Delete all', 'Alles löschen'],
    ['confirm.wipe.title', 'Tüm yerel veriler silinsin mi?', 'Delete all local data?', 'Alle lokalen Daten löschen?'],
    ['confirm.wipe.text', 'Parola kasası dahil her şey silinir. Bu işlem geri alınamaz.', 'Everything including the passphrase vault is deleted. This cannot be undone.', 'Alles einschließlich des Passphrase-Tresors wird gelöscht. Das lässt sich nicht rückgängig machen.'],
    ['confirm.wipe.ok', 'Sil', 'Delete', 'Löschen'],
    ['confirm.type', 'Onaylamak için {w} yaz', 'Type {w} to confirm', 'Zum Bestätigen {w} eingeben'],
    ['confirm.cancel', 'Vazgeç', 'Cancel', 'Abbrechen'],
    ['set.how', 'Bu uygulama nasıl korunuyor', 'How this app is protected', 'Wie diese App geschützt ist'],
    ['how.1', 'Steam parolan hiç alınmaz; giriş QR ile yapılır.', 'Your Steam password is never collected; sign-in uses a QR code.', 'Dein Steam-Passwort wird nie erfasst; die Anmeldung erfolgt per QR-Code.'],
    ['how.2', 'Oturum anahtarı parolandan türetilen AES-256 anahtarıyla şifrelenir, üstüne Windows DPAPI uygulanır.', 'The session key is encrypted with an AES-256 key derived from your passphrase, wrapped again with Windows DPAPI.', 'Der Sitzungsschlüssel wird mit einem aus deiner Passphrase abgeleiteten AES-256-Schlüssel verschlüsselt und zusätzlich mit Windows DPAPI geschützt.'],
    ['how.3', 'Yanlış parola denemeleri yavaşlatılır; 10 hatada kasa silinir.', 'Wrong passphrase attempts are slowed down; the vault is deleted after 10 failures.', 'Falsche Eingaben werden gebremst; nach 10 Fehlversuchen wird der Tresor gelöscht.'],
    ['how.4', 'Arayüz internete çıkamaz; ağ trafiği yalnızca izinli Steam adreslerine gider.', 'The interface cannot reach the internet; network traffic only goes to allow-listed Steam addresses.', 'Die Oberfläche hat keinen Internetzugriff; Netzwerkverkehr geht nur an erlaubte Steam-Adressen.'],
    ['how.5', 'Telemetri, reklam, dış sunucu ya da açık port yok. Hesap bilgin başka yere gönderilmez.', 'No telemetry, ads, external servers or open ports. Your account data is not sent anywhere else.', 'Keine Telemetrie, Werbung, externen Server oder offenen Ports. Deine Kontodaten werden nirgends sonst hingesendet.'],

    // ---- tepsi / sistem bildirimi (ana süreç)
    ['tray.open', "Cardfall'ı aç", 'Open Cardfall', 'Cardfall öffnen'],
    ['tray.pause', 'Duraklat', 'Pause', 'Pausieren'],
    ['tray.resume', 'Devam et', 'Resume', 'Fortsetzen'],
    ['tray.lock', 'Kilitle', 'Lock', 'Sperren'],
    ['tray.quit', 'Çıkış', 'Quit', 'Beenden'],
    ['tray.running', 'Cardfall — {n} oyun çalışıyor', 'Cardfall — {n} games running', 'Cardfall — {n} Spiele laufen'],
    ['tray.waiting', 'Cardfall — bekliyor', 'Cardfall — waiting', 'Cardfall — wartet'],
    ['tray.paused', 'Cardfall — duraklatıldı', 'Cardfall — paused', 'Cardfall — pausiert'],
    ['notif.title', 'Kart düştü', 'Card dropped', 'Karte gefallen'],
  ];
  for (const [key, tr, en, de] of rows) { D.tr[key] = tr; D.en[key] = en; D.de[key] = de; }

  function t(lang, key, p) {
    let s = (D[lang] && D[lang][key]);
    if (s === undefined) s = D.en[key];
    if (s === undefined) return key;
    if (s.includes('|') && p && typeof p.n === 'number') {
      const [one, other] = s.split('|');
      s = p.n === 1 ? one : other;
    }
    if (p) s = s.replace(/\{(\w+)\}/g, (_, k) => (p[k] === undefined || p[k] === null ? '' : String(p[k])));
    return s;
  }

  /** setting: auto|tr|en|de; locale: işletim sistemi dili (ör. "tr", "de-AT"). */
  function resolve(setting, locale) {
    if (LANGS.includes(setting)) return setting;
    const l = String(locale || '').toLowerCase().slice(0, 2);
    return LANGS.includes(l) ? l : 'en';
  }

  return { LANGS, NAMES, LOCALES, CONFIRM_WORD, D, t, resolve };
});
