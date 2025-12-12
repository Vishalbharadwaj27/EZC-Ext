const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'webview', 'index.html');
const assetsDir = path.join(root, 'assets');

const html = fs.readFileSync(htmlPath, 'utf8');

// Find src or href attributes that start with /assets/
const re = /(src|href)="\/assets\/([^"]+)"/g;
let m;
const referenced = new Set();
while ((m = re.exec(html)) !== null) {
  referenced.add(m[2]);
}

if (referenced.size === 0) {
  console.log('No /assets/ references found in webview/index.html');
  process.exit(0);
}

let missing = [];
for (const rel of referenced) {
  const p = path.join(assetsDir, rel);
  if (!fs.existsSync(p)) missing.push(rel);
}

console.log('Referenced assets (found):');
for (const r of referenced) {
  const p = path.join(assetsDir, r);
  console.log(' -', r, fs.existsSync(p) ? '(OK)' : '(MISSING)');
}

if (missing.length) {
  console.error('\nMissing assets:');
  missing.forEach(x => console.error(' -', x));
  process.exit(2);
} else {
  console.log('\nAll referenced assets exist in assets/');
  process.exit(0);
}
