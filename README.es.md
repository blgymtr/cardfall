<div align="center">

<img src="build/icon.png" width="96" alt="Icono de Cardfall">

# Cardfall

**Un idler de cartas coleccionables de Steam, tranquilo y seguro, para Windows.**
Inicia sesión con un código QR, deja que tus juegos «jueguen» y mira cómo caen las cartas.

[![CI](https://github.com/blgymtr/cardfall/actions/workflows/ci.yml/badge.svg)](https://github.com/blgymtr/cardfall/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/blgymtr/cardfall)](https://github.com/blgymtr/cardfall/releases/latest)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-green.svg)](LICENSE)

[English](README.md) · [Deutsch](README.de.md) · [Türkçe](README.tr.md) · [Italiano](README.it.md) · [Français](README.fr.md) · **Español**

<img src="docs/screenshots/app-dark.png" alt="Ventana principal de Cardfall (datos de demostración)" width="860">

</div>

## Descarga

Descarga el instalador de la [última versión](https://github.com/blgymtr/cardfall/releases/latest) (`Cardfall-Setup-<versión>.exe`, Windows 10/11, 64 bits).
El instalador **no está firmado**: Windows SmartScreen puede avisar en el primer arranque (Más información → Ejecutar de todas formas). La suma SHA-256 está en la release.

## Funciones

- **Inicio de sesión con QR.** Tu contraseña de Steam nunca se introduce ni se guarda.
- **Ejecución inteligente.** Los juegos de menos de 2 horas juntos (hasta 32) y luego de uno en uno. O de 1 a 32 juegos fijos.
- **Juegos atascados relegados.** Un juego de más de 2 horas que deja de dar cartas pasa al final de la cola tras el tiempo que elijas.
- **Control total.** Pausar y reanudar, siguiente juego, iniciar un juego al instante, ocultar juegos.
- **Información de juegos siempre al día.** Imagen de cada juego (con alternativa a la imagen actual de la tienda), descripción, géneros, desarrollador y fecha de lanzamiento al hacer clic. Imágenes e información se actualizan en segundo plano cada 7 días.
- **Cifras y estadísticas en vivo:** tiempo en marcha, cartas por caer, cola, cartas caídas, juegos iniciados, juegos con y sin cartas, gráfico de 14 días, valor estimado según el Mercado de Steam.
- **Inicio con Windows** (oculto, espera tu frase de contraseña) y **modo bandeja**.
- **Seis idiomas** (English, Deutsch, Türkçe, Italiano, Français, Español), tema claro y oscuro.
- **Datos y privacidad:** sesión actual, borrado del registro, del historial y de la caché, restablecer estadísticas, cerrar sesión por completo y eliminación permanente (los archivos se sobrescriben primero con datos aleatorios).

## Seguridad

Caja fuerte cifrada (AES-256-GCM, scrypt N=2^17 + Windows DPAPI), frase de contraseña de al menos 10 caracteres, intentos limitados (la caja fuerte se elimina tras 10 fallos), bloqueo automático con la clave borrada de la memoria, datos locales cifrados, interfaz aislada sin acceso a Internet (CSP estricta, sandbox, IPC limitada), red solo hacia direcciones de Steam permitidas, Electron reforzado, sin telemetría. Detalles en la [política de seguridad](SECURITY.md) y en el [README en inglés](README.md#security).

## Primeros pasos

1. Instala y abre Cardfall.
2. Elige una frase de contraseña: protege la sesión de Steam guardada en este equipo.
3. En la aplicación de Steam de tu teléfono abre **Steam Guard**, escanea el código QR que muestra Cardfall y confirma.

## Conviene saber

Steam no da cartas antes de unas **2 horas** de juego. Las cartas caen al azar y las decide Steam. Si inicias un juego en otro sitio con la misma cuenta, Cardfall espera. Los valores estimados son orientativos. Tus datos están en `%APPDATA%\Cardfall` y se gestionan en **Ajustes → Datos y privacidad**.

## Aviso

Cardfall es un proyecto de aficionado independiente, sin relación con Valve Corporation. Lo usas bajo tu responsabilidad y eres responsable de cumplir el Acuerdo de suscriptor de Steam.

## Licencia

[MIT](LICENSE) © 2026 Ömer
