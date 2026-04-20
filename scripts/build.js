const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSION_DIR = path.join(__dirname, '..', 'extension');
const DIST_DIR = path.join(__dirname, '..', 'dist');

function clean() {
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

function copyFiles(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(EXTENSION_DIR, targetDir, { recursive: true });
}

function buildChrome() {
  const chromeDir = path.join(DIST_DIR, 'chrome');
  copyFiles(chromeDir);
  console.log('Built Chrome version');
}

function buildFirefox() {
  const firefoxDir = path.join(DIST_DIR, 'firefox');
  copyFiles(firefoxDir);

  const manifestPath = path.join(firefoxDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // 1. Replace declarativeNetRequestWithHostAccess with declarativeNetRequest
  if (manifest.permissions) {
    manifest.permissions = manifest.permissions.map(p => 
      p === 'declarativeNetRequestWithHostAccess' ? 'declarativeNetRequest' : p
    );
  }

  // 2. Add browser_specific_settings
  manifest.browser_specific_settings = {
    gecko: {
      id: 'transcriptonic@vivek.nexus',
      strict_min_version: '109.0'
    }
  };

  // 3. Convert background.service_worker to background.scripts
  if (manifest.background && manifest.background.service_worker) {
    const serviceWorker = manifest.background.service_worker;
    delete manifest.background.service_worker;
    manifest.background.scripts = [serviceWorker];
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('Built Firefox version');
}

function zip(source, out) {
  const absSource = path.resolve(source);
  const absOut = path.resolve(out);
  
  try {
    // cd into the source directory to avoid including the directory name in the zip
    execSync(`cd "${absSource}" && python3 -m zipfile -c "${absOut}" .`);
    console.log(`Created ${out}`);
  } catch (error) {
    console.error(`Failed to create ${out}:`, error.message);
  }
}

function main() {
  try {
    clean();
    buildChrome();
    buildFirefox();

    console.log('Packaging...');
    zip(path.join(DIST_DIR, 'chrome'), path.join(DIST_DIR, 'transcriptonic-chrome.zip'));
    zip(path.join(DIST_DIR, 'firefox'), path.join(DIST_DIR, 'transcriptonic-firefox.zip'));
    console.log('Done!');
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

main();
