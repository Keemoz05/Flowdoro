# Pomobodo Bundling Guide (Windows)

This guide explains how to compile and bundle the Pomobodo Tauri application into a standalone Windows executable (`.exe`) and installer packages.

---

## 🛠️ Prerequisites

Tauri compiles the application using a Rust backend. To bundle the application successfully on Windows, ensure the following are installed:

1. **Rust (toolchain & cargo)**: Already installed (`rustc 1.96.0` detected).
2. **Microsoft Visual Studio C++ Build Tools**: Required by Rust to compile C++ dependencies. 
   - If you don't have it installed, download the [Visual Studio Installer](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and select the **Desktop development with C++** workload.
3. **Node.js & npm**: Installed (since this is a Node.js project workspace).
4. **WebView2**: Built into Windows 10/11 by default.

---

## 🚀 Bundling Steps

### 1. Install Node Dependencies
Before starting the build, ensure all package-level dependencies are installed:
```powershell
npm install
```

### 2. Run the Build Command
To bundle the application, run the Tauri build command from the root directory of the project (`Pomobodo`):
```powershell
npm run tauri build
```
*Alternatively, you can run:*
```powershell
npx tauri build
```

This command will:
1. Load your configuration from `src-tauri/tauri.conf.json`.
2. Compile the Rust backend using `cargo` in release mode.
3. Inject the static frontend assets from your `src` directory directly into the binary.
4. Package the compiled app into an installer.

---

## 📂 Output Locations

Once the build completes successfully, Tauri will place the generated files under the `src-tauri/target/release` directory.

### 1. Standalone Executable
If you just want a single executable file that runs without installation, you can find it here:
```plaintext
src-tauri/target/release/Pomobodo.exe
```
> [!NOTE]
> This single `.exe` is fully self-contained because Tauri embeds all HTML, CSS, JavaScript, and asset files directly inside the binary.

### 2. Installers
If you want to distribute the app to other users, Tauri packages it into Windows installers:
* **NSIS Installer (`.exe` setup program)**:
  ```plaintext
  src-tauri/target/release/bundle/nsis/Pomobodo_1.0.0_x64-setup.exe
  ```
* **MSI Installer (`.msi` package)**:
  ```plaintext
  src-tauri/target/release/bundle/msi/Pomobodo_1.0.0_x64_en-US.msi
  ```

---

## ⚙️ Configuration Customization

If you want to change the details of the bundled executable (such as name, version, or icons) before building, edit `src-tauri/tauri.conf.json`:

* **Product Name**: Change `"productName": "Pomobodo"` to customize the app's display name and executable name.
* **App Version**: Update `"version": "1.0.0"` to set the release version.
* **App Icon**: Replace the icon assets inside `src-tauri/icons/` to customize the application icon.
