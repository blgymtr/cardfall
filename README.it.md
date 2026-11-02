<div align="center">

<img src="build/icon.png" width="96" alt="Icona di Cardfall">

# Cardfall

**Un idler di carte collezionabili Steam, calmo e sicuro, per Windows.**
Accedi con un codice QR, lascia "giocare" i tuoi giochi e guarda cadere le carte.

[![CI](https://github.com/blgymtr/cardfall/actions/workflows/ci.yml/badge.svg)](https://github.com/blgymtr/cardfall/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/blgymtr/cardfall)](https://github.com/blgymtr/cardfall/releases/latest)
[![Licenza: MIT](https://img.shields.io/badge/licenza-MIT-green.svg)](LICENSE)

[English](README.md) · [Deutsch](README.de.md) · [Türkçe](README.tr.md) · **Italiano** · [Français](README.fr.md) · [Español](README.es.md)

<img src="docs/screenshots/app-dark.png" alt="Finestra principale di Cardfall (dati demo)" width="860">

</div>

## Download

Scarica l'installer dall'[ultima release](https://github.com/blgymtr/cardfall/releases/latest) (`Cardfall-Setup-<versione>.exe`, Windows 10/11, 64 bit).
L'installer **non è firmato**: Windows SmartScreen può avvisarti al primo avvio (Maggiori informazioni → Esegui comunque). Il checksum SHA-256 è nella release.

## Funzioni

- **Accesso con QR.** La tua password Steam non viene mai inserita né salvata.
- **Esecuzione smart.** I giochi sotto le 2 ore insieme (fino a 32), poi uno alla volta. Oppure da 1 a 32 giochi fissi.
- **Giochi bloccati retrocessi.** Un gioco oltre le 2 ore che smette di dare carte va in fondo alla coda dopo il tempo che scegli.
- **Controllo totale.** Pausa e ripresa, gioco successivo, avvio immediato di un gioco, giochi nascosti.
- **Info sui giochi sempre aggiornate.** Immagine di ogni gioco (con ripiego sull'immagine attuale dello store), descrizione, generi, sviluppatore e data di uscita al clic. Immagini e info vengono aggiornate in background ogni 7 giorni.
- **Numeri e statistiche in tempo reale:** tempo di esecuzione, carte rimaste, coda, carte cadute, giochi avviati, giochi con e senza drop, grafico di 14 giorni, valore stimato dal Mercato Steam.
- **Avvio con Windows** (nascosto, attende la passphrase) e **modalità area di notifica**.
- **Sei lingue** (English, Deutsch, Türkçe, Italiano, Français, Español), tema chiaro e scuro.
- **Dati e privacy:** sessione attuale, pulizia di registro, cronologia e cache, azzeramento statistiche, uscita completa dall'account ed eliminazione definitiva (i file vengono prima sovrascritti con dati casuali).

## Sicurezza

Cassaforte cifrata (AES-256-GCM, scrypt N=2^17 + Windows DPAPI), passphrase di almeno 10 caratteri, tentativi limitati (cassaforte eliminata dopo 10 errori), blocco automatico con chiave cancellata dalla memoria, dati locali cifrati, interfaccia isolata senza accesso a Internet (CSP rigorosa, sandbox, IPC limitata), rete solo verso indirizzi Steam consentiti, Electron irrobustito, nessuna telemetria. Dettagli nella [politica di sicurezza](SECURITY.md) e nel [README inglese](README.md#security).

## Per iniziare

1. Installa e avvia Cardfall.
2. Scegli una passphrase: protegge la sessione Steam salvata su questo computer.
3. Nell'app Steam sul telefono apri **Steam Guard**, inquadra il codice QR mostrato da Cardfall e conferma.

## Da sapere

Steam non assegna carte prima di circa **2 ore** di gioco. I drop sono casuali e li decide Steam. Se avvii un gioco altrove con lo stesso account, Cardfall aspetta. I valori stimati sono indicativi. I dati sono in `%APPDATA%\Cardfall` e si gestiscono da **Impostazioni → Dati e privacy**.

## Avvertenza

Cardfall è un progetto hobbistico indipendente, non affiliato a Valve Corporation. Lo usi a tuo rischio e sei responsabile del rispetto del Contratto di abbonamento Steam.

## Licenza

[MIT](LICENSE) © 2026 Ömer
