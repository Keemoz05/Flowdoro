import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// 1. Determine target version
let targetVersion = process.argv[2];

const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

if (targetVersion) {
  targetVersion = targetVersion.replace(/^v/, '').trim();
  if (targetVersion === 'patch' || targetVersion === 'minor' || targetVersion === 'major') {
    const [maj, min, pat] = (pkg.version || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);
    if (targetVersion === 'patch') targetVersion = `${maj}.${min}.${pat + 1}`;
    if (targetVersion === 'minor') targetVersion = `${maj}.${min + 1}.0`;
    if (targetVersion === 'major') targetVersion = `${maj + 1}.0.0`;
  }
  pkg.version = targetVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated package.json to ${targetVersion}`);
} else {
  targetVersion = pkg.version;
}

console.log(`Synchronizing project files to version: ${targetVersion}`);

// 2. Update src-tauri/tauri.conf.json
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = targetVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log(`Updated ${tauriConfPath}`);
}

// 3. Update src-tauri/Cargo.toml
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoTomlPath)) {
  let cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
  cargoContent = cargoContent.replace(/^version\s*=\s*"[^"]+"/m, `version = "${targetVersion}"`);
  fs.writeFileSync(cargoTomlPath, cargoContent, 'utf8');
  console.log(`Updated ${cargoTomlPath}`);
}

// 4. Update src-tauri/Cargo.lock
const cargoLockPath = path.join(rootDir, 'src-tauri', 'Cargo.lock');
if (fs.existsSync(cargoLockPath)) {
  let cargoLock = fs.readFileSync(cargoLockPath, 'utf8');
  cargoLock = cargoLock.replace(
    /(\[\[package\]\]\r?\nname\s*=\s*"flowdoro"\r?\nversion\s*=\s*)"[^"]+"/,
    `$1"${targetVersion}"`
  );
  fs.writeFileSync(cargoLockPath, cargoLock, 'utf8');
  console.log(`Updated ${cargoLockPath}`);
}

// 5. Update src/updater.js (fallback constant)
const updaterJsPath = path.join(rootDir, 'src', 'updater.js');
if (fs.existsSync(updaterJsPath)) {
  let updaterContent = fs.readFileSync(updaterJsPath, 'utf8');
  updaterContent = updaterContent.replace(
    /export\s+let\s+APP_VERSION\s*=\s*'[^']+';/,
    `export let APP_VERSION = '${targetVersion}';`
  );
  fs.writeFileSync(updaterJsPath, updaterContent, 'utf8');
  console.log(`Updated ${updaterJsPath}`);
}

console.log(`Successfully synchronized all files to v${targetVersion}!`);
