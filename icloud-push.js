#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * Custom sync script to replace rsync functionality
 * Syncs recipes from recipes folder to iCloud CookLang app directory
 */

const sourceDir = path.join(__dirname, "src", "posts", "recipes");
const targetDir = path.join(
  os.homedir(),
  "Library",
  "Mobile Documents",
  "iCloud~org~cooklang~cooklangapp",
  "Documents"
);
const excludePatterns = [".DS_Store"];

function shouldExclude(fileName) {
  return excludePatterns.some((pattern) => {
    if (pattern.includes("*")) {
      // Simple wildcard matching
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));
      return regex.test(fileName);
    }
    return fileName === pattern;
  });
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

function copyFile(srcPath, targetPath) {
  try {
    const stats = fs.statSync(srcPath);
    fs.copyFileSync(srcPath, targetPath);
    fs.utimesSync(targetPath, stats.atime, stats.mtime);
    console.log(`Copied: ${path.relative(sourceDir, srcPath)}`);
  } catch (error) {
    console.error(`Error copying ${srcPath}: ${error.message}`);
  }
}

function syncDirectory(srcDir, targetDir) {
  ensureDir(targetDir);

  const items = fs.readdirSync(srcDir);

  for (const item of items) {
    if (shouldExclude(item)) {
      console.log(`Excluding: ${item}`);
      continue;
    }

    const srcPath = path.join(srcDir, item);
    const targetPath = path.join(targetDir, item);
    const stats = fs.statSync(srcPath);

    if (stats.isDirectory()) {
      syncDirectory(srcPath, targetPath);
    } else if (stats.isFile()) {
      // Check if file needs to be updated
      let needsUpdate = true;

      if (fs.existsSync(targetPath)) {
        const srcStats = fs.statSync(srcPath);
        const targetStats = fs.statSync(targetPath);

        // Compare modification times and sizes
        needsUpdate =
          srcStats.mtime > targetStats.mtime ||
          srcStats.size !== targetStats.size;
      }

      if (needsUpdate) {
        copyFile(srcPath, targetPath);
      } else {
        console.log(
          `Skipping (up to date): ${path.relative(sourceDir, srcPath)}`
        );
      }
    }
  }
}

/**
 * Main sync function
 */
function main() {
  console.log("Starting recipe sync...");
  console.log(`Source: ${sourceDir}`);
  console.log(`Target: ${targetDir}`);
  console.log("---");

  // Check if source directory exists
  if (!fs.existsSync(sourceDir)) {
    console.error(`Source directory does not exist: ${sourceDir}`);
    process.exit(1);
  }

  // Check if target directory is accessible
  const targetParent = path.dirname(targetDir);
  if (!fs.existsSync(targetParent)) {
    console.error(`Target parent directory does not exist: ${targetParent}`);
    console.error("Make sure iCloud and CookLang app are properly set up.");
    process.exit(1);
  }

  try {
    syncDirectory(sourceDir, targetDir);
    console.log("---");
    console.log("Sync completed successfully!");
  } catch (error) {
    console.error("Sync failed:", error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { syncDirectory, shouldExclude };
