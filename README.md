# VIP Display

Aplicación fullscreen tipo kiosko para mostrar contenido VIP en pantallas de gran formato. Construida con Tauri, HTML, CSS y JavaScript, con backend en Rust.

## Tecnologías utilizadas

- **Tauri v1** — Framework de escritorio multiplataforma (Rust + WebView)
- **Rust** — Backend nativo (manejo de ventanas, recursos del sistema)
- **HTML / CSS / JavaScript** — Frontend web
- **Node.js** — Entorno para herramientas de desarrollo (CLI de Tauri)

## Requisitos

- **Node.js** 18 o superior
- **Rust** (instalado mediante [rustup](https://rustup.rs/))
- **Windows 10 / 11** (el proyecto está configurado para compilar en Windows)

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/TGabVoid/QuitusPoio.git
cd QuitusPoio

# Instalar dependencias de Node.js
npm install
```

## Cómo ejecutar en desarrollo

```bash
npm run tauri:dev
```

Este comando compilará el backend de Rust y abrirá la ventana de la aplicación en modo desarrollo con recarga en caliente.

## Cómo generar el ejecutable

```bash
npm run tauri:build
```

El instalador ejecutable se generará en `src-tauri/target/release/bundle/nsis/` como `VIPDisplay_X.X.X_x64-setup.exe` (o similar, según la configuración de empaquetado).

## Estructura del proyecto

```
.
├── .gitignore                  # Archivos ignorados por Git
├── package.json                # Dependencias y scripts de Node.js
├── package-lock.json           # Lockfile de npm (reproducible)
├── README.md                   # Este archivo
│
├── src/                        # Frontend (HTML/CSS/JS)
│   ├── index.html              # Página principal
│   ├── script.js               # Lógica del frontend
│   ├── style.css               # Estilos de la aplicación
│   └── assets/                 # Recursos multimedia
│       ├── pollon.png
│       ├── flyers/             # Imágenes promocionales
│       └── vip/                # Recursos de la sección VIP
│
├── src-tauri/                  # Backend de Tauri (Rust)
│   ├── Cargo.toml              # Dependencias de Rust
│   ├── Cargo.lock              # Lockfile de Cargo (reproducible)
│   ├── build.rs                # Script de compilación de Tauri
│   ├── tauri.conf.json         # Configuración de la ventana y empaquetado
│   ├── icons/
│   │   └── icon.ico            # Icono de la aplicación
│   ├── bundle-resources/       # Recursos adicionales para el empaquetado
│   └── src/
│       └── main.rs             # Código principal de Rust
│
└── tools/                      # Utilidades de desarrollo
    └── png-to-ico.js           # Conversor de PNG a ICO
```

## Licencia

MIT

---

## Notas para desarrolladores

- La aplicación se ejecuta en pantalla completa sin bordes (`fullscreen: true`, `decorations: false`).
- El zoom tipo navegador está disponible: Ctrl + rueda del ratón, Ctrl + / Ctrl - / Ctrl 0.
- NFC simulado: la tecla **ESPACIO** dispara el flujo de entrada cuando el valor capturado es un espacio.