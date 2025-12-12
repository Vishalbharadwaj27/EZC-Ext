#!/usr/bin/env node
// scripts/clean-codeviz-media.js
// Safe cleanup script for CodevViz media folder with backup and dry-run support

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const mediaDir = path.join(__dirname, '..', 'codeviz', 'codeviz', 'media');
const backupDir = path.join(__dirname, '..', 'backups');

if (!fs.existsSync(mediaDir)) {
  console.error('❌ No media dir found at', mediaDir);
  process.exit(1);
}

console.log(dryRun ? '🧪 DRY RUN MODE - No changes will be made' : '🗑️ CLEANUP MODE');
console.log(`📁 Media directory: ${mediaDir}\n`);

// Create backup directory
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('Z')[0];
const zipPath = path.join(backupDir, `codeviz-media-backup-${timestamp}.zip`);

// Zip the entire media directory
function zipDir(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => resolve());
    archive.on('error', err => reject(err));
    output.on('error', err => reject(err));
    
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIdx = 0;
  while (size >= 1024 && unitIdx < units.length - 1) {
    size /= 1024;
    unitIdx++;
  }
  return size.toFixed(2) + ' ' + units[unitIdx];
}

function formatPath(filePath) {
  return path.relative(mediaDir, filePath);
}

// Gather all files with sizes
function walkDir(dir) {
  const files = [];
  try {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        files.push(...walkDir(p));
      } else {
        files.push({ path: p, size: stat.size });
      }
    }
  } catch (e) {
    console.warn(`⚠️  Warning reading ${dir}: ${e.message}`);
  }
  return files;
}

async function main() {
  try {
    // Step 1: Create backup
    if (!dryRun) {
      console.log(`⏳ Creating backup zip at ${zipPath}...`);
      await zipDir(mediaDir, zipPath);
      console.log(`✅ Backup created: ${formatBytes(fs.statSync(zipPath).size)}\n`);
    } else {
      console.log(`[DRY-RUN] Would create backup at ${zipPath}\n`);
    }

    // Step 2: Gather files and display top 50 largest
    console.log('📊 Scanning media directory...');
    const allFiles = walkDir(mediaDir);
    allFiles.sort((a, b) => b.size - a.size);

    console.log(`\n🔝 Top 50 largest files:\n`);
    allFiles.slice(0, 50).forEach((f, idx) => {
      console.log(`  ${(idx + 1).toString().padStart(2)}. ${formatBytes(f.size).padStart(10)} — ${formatPath(f.path)}`);
    });

    // Step 3: Identify files to keep
    const keepNames = new Set([
      path.join(mediaDir, 'viz.js'),
      path.join(mediaDir, 'viz.full.render.js'),
      path.join(mediaDir, 'webview.js'),
      path.join(mediaDir, 'webview.css')
    ]);

    // Step 4: Categorize files for cleanup
    const removed = [];
    const moved = [];
    const skipped = [];
    let freedBytes = 0;

    const unusedLargeDir = path.join(backupDir, `codeviz-unused-${timestamp}`);
    if (!fs.existsSync(unusedLargeDir) && !dryRun) {
      fs.mkdirSync(unusedLargeDir, { recursive: true });
    }

    // Patterns for safe deletion
    const safeDeletePatterns = [
      /\.map$/,                      // Source maps
      /\.md$/i,                       // Markdown docs
      /readme/i,                      // README files
      /\/test(s)?\//,                 // Test directories
      /\btest\.js$/i,                 // Test files
      /\/example(s)?\//',             // Examples
      /\.log$/,                       // Log files
      /LICENSE/i,                     // License files
    ];

    const largeFileThreshold = 10 * 1024 * 1024; // 10MB

    for (const f of allFiles) {
      const rel = formatPath(f.path);
      
      // Never delete these
      if (keepNames.has(f.path)) {
        continue;
      }

      // Check if file matches safe delete pattern
      let shouldDelete = false;
      for (const pattern of safeDeletePatterns) {
        if (pattern.test(rel)) {
          shouldDelete = true;
          break;
        }
      }

      // Delete safe files
      if (shouldDelete) {
        if (!dryRun) {
          fs.unlinkSync(f.path);
        }
        removed.push({ path: rel, size: f.size });
        freedBytes += f.size;
        continue;
      }

      // Move large images and node_modules to backup
      const isBinary = /\.(png|jpg|jpeg|gif|mp4|mov|zip|tar|tgz|whl|so|dylib|dll)$/i.test(f.path);
      const isNodeModules = /node_modules/.test(rel);
      const isLarge = f.size > largeFileThreshold;

      if (isNodeModules || isLarge || isBinary) {
        if (!dryRun) {
          const safeName = rel.replace(/[\/\\]/g, '_').replace(/\.\./g, '__');
          const dest = path.join(unusedLargeDir, safeName);
          try {
            fs.copyFileSync(f.path, dest);
            fs.unlinkSync(f.path);
          } catch (e) {
            console.warn(`⚠️  Could not move ${rel}: ${e.message}`);
            skipped.push({ path: rel, size: f.size, reason: e.message });
            continue;
          }
        }
        moved.push({ path: rel, size: f.size });
        freedBytes += f.size;
        continue;
      }

      // Skip small text/config files
      if (f.size < 1024 * 1024) {
        // Keep small files (< 1MB)
        continue;
      }

      // For anything else large, be conservative and skip
      skipped.push({ path: rel, size: f.size, reason: 'Unknown format' });
    }

    // Step 5: Generate report
    const report = {
      timestamp,
      dryRun,
      summary: {
        totalFreedBytes: freedBytes,
        totalFreedMB: (freedBytes / 1024 / 1024).toFixed(2),
        filesRemoved: removed.length,
        filesMoved: moved.length,
        filesSkipped: skipped.length,
      },
      removed: removed.map(f => ({ path: f.path, size: f.size, sizeMB: (f.size / 1024 / 1024).toFixed(2) })),
      moved: moved.map(f => ({ path: f.path, size: f.size, sizeMB: (f.size / 1024 / 1024).toFixed(2) })),
      skipped: skipped.map(f => ({ path: f.path, size: f.size, sizeMB: (f.size / 1024 / 1024).toFixed(2), reason: f.reason })),
      kept: Array.from(keepNames).map(p => formatPath(p)),
    };

    const reportPath = path.join(backupDir, `codeviz-cleanup-report-${timestamp}.json`);
    if (!dryRun) {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    }

    // Step 6: Display summary
    console.log('\n' + '='.repeat(70));
    console.log(`${dryRun ? '🧪 DRY RUN SUMMARY' : '📋 CLEANUP SUMMARY'}`);
    console.log('='.repeat(70));
    console.log(`\n✅ Files to remove:  ${removed.length}`);
    if (removed.slice(0, 5).length > 0) {
      removed.slice(0, 5).forEach(f => console.log(`   - ${f.path} (${formatBytes(f.size)})`));
      if (removed.length > 5) console.log(`   ... and ${removed.length - 5} more`);
    }

    console.log(`\n📦 Files to move:   ${moved.length}`);
    if (moved.slice(0, 5).length > 0) {
      moved.slice(0, 5).forEach(f => console.log(`   - ${f.path} (${formatBytes(f.size)})`));
      if (moved.length > 5) console.log(`   ... and ${moved.length - 5} more`);
    }

    console.log(`\n⏭️  Files to skip:    ${skipped.length}`);
    if (skipped.slice(0, 5).length > 0) {
      skipped.slice(0, 5).forEach(f => console.log(`   - ${f.path} (${formatBytes(f.size)}) — ${f.reason}`));
      if (skipped.length > 5) console.log(`   ... and ${skipped.length - 5} more`);
    }

    console.log(`\n💾 Space to be freed: ${formatBytes(freedBytes)}\n`);

    if (!dryRun) {
      console.log(`✨ Report saved to: ${reportPath}`);
      console.log(`💾 Backup saved to:  ${zipPath}`);
    }

    console.log('='.repeat(70) + '\n');

    if (dryRun) {
      console.log('💡 To apply changes, run: npm run clean-codeviz-media\n');
    } else {
      console.log('✅ Cleanup complete!\n');
    }

  } catch (err) {
    console.error('❌ Error during cleanup:', err.message);
    process.exit(1);
  }
}

main();
