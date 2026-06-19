# How to Change Application Icons in Pomobodo

Tauri apps compile native binaries for multiple platforms, each of which has specific requirements for application icons. This guide details why those files exist and how to regenerate them using Tauri's CLI.

---

## 1. Why There Are So Many Icon Files
When you check the `src-tauri/icons/` folder, you will see a variety of image files. Each serves a specific target system:

* **`.ico` (`icon.ico`)**: Used by Windows for desktop icons, the taskbar, and file explorer.
* **`.icns` (`icon.icns`)**: Used by macOS for application bundles (containing multi-resolution icons for standard and Retina displays).
* **PNGs (`32x32.png`, `128x128.png`, etc.)**: Used by Linux desktop environments (like GNOME and KDE).
* **Store Logos (`StoreLogo.png`, `Square150x150Logo.png`, etc.)**: Used by Windows/MSIX packages for the Microsoft Store.
* **iOS / Android folders**: Created automatically to support mobile platforms if the application is compiled for mobile.

---

## 2. How to Regenerate Icons
Instead of manually creating each icon size and format, Tauri provides an automated generator tool.

### Prerequisites
* A high-resolution, square image (ideally a **`512x512`** or **`1024x1024`** pixel `.png` or `.jpg` file).
* Place the source image in the root directory of your project (e.g., `timemovesslow.jpg` or `app-logo.png`).

### Command
Run the following command in the project root:

```bash
npx tauri icon <path-to-your-image>
```

**Example:**
```bash
npx tauri icon .\timemovesslow.jpg
```

This will automatically:
1. Decode the source image.
2. Generate all the platform-specific files.
3. Overwrite the files inside `src-tauri/icons/` with the new design.

---

## 3. Applying the Changes
Once the icons are generated, they are already linked in your `tauri.conf.json` file:

```json
"bundle": {
  "active": true,
  "targets": "all",
  "icon": [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico"
  ]
}
```

To build your application executable with the new icons, run:

```bash
npm run tauri build
```
