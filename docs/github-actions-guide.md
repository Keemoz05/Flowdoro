# GitHub Actions CI/CD — Full Walkthrough

## 📦 The Big Picture

```
You push code to GitHub
        ↓
GitHub sees the push and reads your workflow file
        ↓
GitHub spins up a brand new Windows computer (virtual machine) in the cloud
        ↓
That VM downloads your code, installs Rust & Node, and runs "tauri build"
        ↓
The resulting .exe and .msi files are uploaded to your repo's Releases tab
        ↓
Anyone can now download and install your app
```

You never touch a server. GitHub does everything automatically. That's **CI/CD** (Continuous Integration / Continuous Deployment).

---

## 🗂️ Where The File Lives

```
Pomobodo/
├── .github/
│   └── workflows/
│       └── release.yml    ← THIS FILE controls everything
├── src/
├── src-tauri/
└── package.json
```

> [!IMPORTANT]
> The file **must** be at exactly `.github/workflows/<name>.yml`. GitHub only looks in this folder. If you put it anywhere else, nothing happens.

---

## 🔍 Line-By-Line Breakdown

### Part 1: The Name

```yaml
name: Build & Release
```

This is just a display name. You'll see it in the **Actions** tab on GitHub:

```
┌─────────────────────────────────────────┐
│  Actions                                │
│                                         │
│  ▶ Build & Release    ← this name       │
│    Triggered 2 minutes ago              │
│    Status: ✅ Success                    │
└─────────────────────────────────────────┘
```

---

### Part 2: The Trigger — "When should this run?"

```yaml
on:
  push:
    tags:
      - 'v*'
```

This says: **"Run this workflow whenever someone pushes a Git tag that starts with `v`"**

| Push event | Tag? | Matches `v*`? | Workflow runs? |
|---|---|---|---|
| `git push origin main` | No tag | — | ❌ No |
| Push tag `v1.0.0` | `v1.0.0` | ✅ Yes | ✅ **Yes** |
| Push tag `v2.3.1-beta` | `v2.3.1-beta` | ✅ Yes | ✅ **Yes** |
| Push tag `release-1.0` | `release-1.0` | ❌ No | ❌ No |

The `*` is a wildcard — it matches anything after `v`.

---

### Part 3: The Job — "What computer should run this?"

```yaml
jobs:
  build-windows:
    runs-on: windows-latest
    permissions:
      contents: write
```

| Line | Meaning |
|---|---|
| `jobs:` | Start defining jobs (a workflow can have multiple jobs) |
| `build-windows:` | Name of this job (you pick the name) |
| `runs-on: windows-latest` | Use a Windows virtual machine (GitHub provides these for free) |
| `permissions: contents: write` | Allow this job to create Releases on your repo |

> [!NOTE]
> `windows-latest` is currently Windows Server 2022. GitHub also offers `ubuntu-latest` and `macos-latest`. Since you want `.exe` files, we use Windows.

---

### Part 4: The Steps — "What should the computer do?"

Think of steps as a recipe. The VM starts completely empty — no code, no Rust, no Node. Each step sets something up.

#### Step 1: Download your code

```yaml
- name: Checkout repository
  uses: actions/checkout@v4
```

The VM is a **blank computer**. It doesn't have your code yet. This step clones your GitHub repo onto the VM.

#### Step 2: Install Node.js

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 20
```

Your project needs Node.js for the Tauri CLI (`npx tauri build`).

#### Step 3: Install Rust

```yaml
- name: Setup Rust
  uses: dtolnay/rust-toolchain@stable
```

Tauri's backend is Rust. This installs the Rust compiler.

#### Step 4: Cache (speed optimization)

```yaml
- name: Cache Rust dependencies
  uses: actions/cache@v4
  with:
    path: |
      ~/.cargo/registry
      ~/.cargo/git
      src-tauri/target
    key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
```

Rust builds are **slow** (5-15 min). This saves compiled dependencies between runs so they don't re-compile every time.

#### Step 5: Install npm packages

```yaml
- name: Install Node dependencies
  run: npm install
```

Installs `@tauri-apps/cli` from your `package.json`.

#### Step 6: Build the app

```yaml
- name: Build Tauri app
  run: npx tauri build
```

The **main step**. Compiles Rust, bundles your frontend, and packages into:
- `Pomobodo_1.1.0_x64-setup.exe` (NSIS installer)
- `Pomobodo_1.1.0_x64_en-US.msi` (MSI installer)

#### Step 7: Create the Release

```yaml
- name: Create GitHub Release
  uses: softprops/action-gh-release@v2
  with:
    files: |
      src-tauri/target/release/bundle/msi/*.msi
      src-tauri/target/release/bundle/nsis/*.exe
    generate_release_notes: true
```

Creates a Release page on GitHub with your `.exe` and `.msi` attached:

```
┌──────────────────────────────────────────────────┐
│  Releases                                        │
│                                                  │
│  v1.1.0                                Latest    │
│                                                  │
│  Assets                                          │
│  ┌──────────────────────────────────────────┐     │
│  │ 📦 Pomobodo_1.1.0_x64-setup.exe  (4 MB) │     │
│  │ 📦 Pomobodo_1.1.0_x64_en-US.msi  (4 MB) │     │
│  │ 📄 Source code (zip)                     │     │
│  │ 📄 Source code (tar.gz)                  │     │
│  └──────────────────────────────────────────┘     │
└──────────────────────────────────────────────────┘
```

---

---

# 🚀 How To Release — Step by Step

Two methods to do everything. Pick whichever you prefer.

---

## Phase 1: Push the workflow file to GitHub

You need to push the `release.yml` file first so GitHub knows about it.

### 🖱️ Method A: GitHub Desktop

1. Open **GitHub Desktop**
2. Your `release.yml` will show up in the changes list
3. Type a commit message: `Add CI/CD release workflow`
4. Click **Commit to main**
5. Click **Push origin** (top bar)

### ⌨️ Method B: Terminal

```bash
git add .github/workflows/release.yml
git commit -m "Add CI/CD release workflow"
git push origin main
```

### ✅ How to verify

- Go to **github.com → your repo → Actions tab**
- You should see "Build & Release" listed on the left sidebar
- No build will have run yet (because no tag was pushed)

### ↩️ How to undo

````carousel
**🖱️ GitHub Desktop**

GitHub Desktop doesn't let you undo a push directly. Use the terminal method instead, or simply delete the file and push again:

1. Delete the file `.github/workflows/release.yml` from your file explorer
2. In GitHub Desktop, commit: `Remove workflow file`
3. Push origin
<!-- slide -->
**⌨️ Terminal**

```bash
# Undo the last commit and push (if you JUST pushed it)
git revert HEAD
git push origin main
```

This creates a new commit that undoes the previous one. The file will be removed from GitHub.
````

---

## Phase 2: Create a tag to trigger the build

This is what actually triggers the CI/CD pipeline and builds your `.exe`.

### 🖱️ Method A: GitHub Desktop + Website

GitHub Desktop **cannot create tags**, so you create the tag directly on the GitHub website:

1. Go to **github.com → your repo**
2. Click **Releases** (right sidebar)
3. Click **"Create a new release"** (or **"Draft a new release"**)
4. In the **"Choose a tag"** dropdown, type `v1.1.0`
5. Click **"Create new tag: v1.1.0 on publish"**
6. Set the title to `v1.1.0`
7. Click **Publish release**

> [!NOTE]
> When you create a tag through the website this way, GitHub also creates a Release page. Your workflow will then run and **replace/attach** the built `.exe` and `.msi` files to that same Release automatically.

### ⌨️ Method B: Terminal

```bash
# Create a tag on your current commit
git tag v1.1.0

# Push the tag to GitHub (THIS triggers the build)
git push origin v1.1.0
```

### ✅ How to verify

1. Go to **github.com → your repo → Actions tab**
2. You should see a new workflow run: `Build & Release` with a yellow spinner ⏳
3. Click on it to watch the live logs of each step
4. Wait 8-15 minutes (first build) or 3-8 minutes (cached build)
5. Once it shows ✅, go to **Releases tab** — your `.exe` and `.msi` will be there

### ↩️ How to undo (delete a tag and release)

````carousel
**🖱️ GitHub Desktop + Website**

1. Go to **github.com → your repo → Releases**
2. Click the release you want to delete (e.g., `v1.1.0`)
3. Click the **🗑️ Delete** button (top right of the release)
4. Check **"Also delete the tag v1.1.0"** if prompted
5. Confirm deletion

The release and tag are now completely removed. The workflow run history stays in the Actions tab but won't affect anything.
<!-- slide -->
**⌨️ Terminal**

```bash
# Delete the tag locally
git tag -d v1.1.0

# Delete the tag from GitHub
git push origin --delete v1.1.0
```

Then go to **github.com → Releases** and delete the release page manually (the tag deletion alone doesn't remove the release page).
````

---

## Phase 3: Release a new version (the ongoing workflow)

After the initial setup, this is what your day-to-day looks like:

### 🖱️ Method A: GitHub Desktop + Website

1. **Write code** as normal
2. In **GitHub Desktop**: commit your changes, push to origin
3. When you're ready to release, go to **github.com → Releases → Create new release**
4. Type a new tag like `v1.2.0`, publish
5. Wait for the build, download `.exe` from Releases

### ⌨️ Method B: Terminal

```bash
# 1. Commit and push your changes
git add .
git commit -m "Added new feature"
git push origin main

# 2. Tag and release
git tag v1.2.0
git push origin v1.2.0
```

### ✅ How to verify

- **Actions tab**: shows the build running/completed
- **Releases tab**: shows the new version with downloadable files
- **Tags**: click **Code → Tags** to see all your tags

---

---

# 🎯 Common Scenarios

### Scenario 1: Push code without releasing

Just commit and push normally. **No tag = no build = no release.**

| Method | What to do |
|---|---|
| 🖱️ GitHub Desktop | Commit → Push origin (as you always do) |
| ⌨️ Terminal | `git add . && git commit -m "msg" && git push` |

---

### Scenario 2: Release a beta version

| Method | What to do |
|---|---|
| 🖱️ Website | Create release with tag `v1.2.0-beta` |
| ⌨️ Terminal | `git tag v1.2.0-beta && git push origin v1.2.0-beta` |

The tag starts with `v` so the workflow triggers. The release will be named `v1.2.0-beta`.

---

### Scenario 3: The build failed

1. Go to **Actions tab → click the failed run**
2. Click the red ❌ step to read the error log
3. Fix the issue in your code
4. Delete the old tag and release (see "How to undo" above)
5. Re-tag and push:

| Method | What to do |
|---|---|
| 🖱️ Website | Delete release, create a new release with the same tag |
| ⌨️ Terminal | `git tag -d v1.2.0 && git push origin --delete v1.2.0` then fix, commit, push, re-tag |

---

### Scenario 4: You want to build without releasing to the public

Change `draft: false` to `draft: true` in [release.yml](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/.github/workflows/release.yml#L58):

```yaml
draft: true    # Release will be hidden until you manually publish it
```

The build runs and the `.exe` is uploaded, but only **you** can see it on the Releases page. Click "Edit" → "Publish" when you're ready to make it public.

---

---

# ⚙️ Alternative Trigger Configurations

You can change the `on:` section in [release.yml](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/.github/workflows/release.yml#L4-L7) depending on your needs:

### Option A: Build on every push to main

```yaml
on:
  push:
    branches:
      - main
```

> [!WARNING]
> Builds on **every push**. Burns through free minutes fast.

### Option B: Manual trigger only (button on GitHub)

```yaml
on:
  workflow_dispatch:
```

Go to **Actions → Build & Release → Run workflow** to trigger manually.

### Option C: Tags + manual trigger (recommended)

```yaml
on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
```

Auto-builds on tags, but you can also click a button anytime.

---

# 💰 GitHub Actions Free Tier

| Plan | Monthly Minutes | Windows Rate | Effective Windows Minutes |
|---|---|---|---|
| Free | 2,000 | 2x | ~1,000 |
| Pro | 3,000 | 2x | ~1,500 |

A typical Tauri build takes **8-15 minutes**. With caching, subsequent builds drop to **3-8 minutes**. On the free plan, you can do roughly **60-120 releases per month**.

---

# ✅ Final Checklist

- [x] Workflow file created at `.github/workflows/release.yml`
- [ ] Push the workflow file to GitHub (Phase 1)
- [ ] Make sure your repo has Actions enabled (it is by default for public repos)
- [ ] Create your first tag `v1.1.0` (Phase 2)
- [ ] Watch the build in the Actions tab
- [ ] Download your `.exe` from the Releases tab
