#!/usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function getGitLastModifiedIso(filePath) {
  try {
    const iso = execSync(
      `git log --follow --format=%aI -1 -- ${JSON.stringify(filePath)}`,
      { encoding: "utf-8" }
    )
      .toString()
      .trim();
    return iso || null;
  } catch (e) {
    return null;
  }
}

function main() {
  // Ensure full history for accurate first-commit dates in shallow clones
  try {
    const isRepo = execSync("git rev-parse --is-inside-work-tree", {
      encoding: "utf-8",
    })
      .toString()
      .trim();
    if (isRepo === "true") {
      const isShallow = execSync("git rev-parse --is-shallow-repository", {
        encoding: "utf-8",
      })
        .toString()
        .trim();
      if (isShallow === "true") {
        try {
          execSync("git fetch --unshallow --tags --prune", {
            stdio: "inherit",
          });
        } catch (e) {
          // Ignore fetch errors so build doesn't fail
        }
      }
    }
  } catch (e) {
    // ignore
  }

  const repoRoot = execSync("git rev-parse --show-toplevel", {
    encoding: "utf-8",
  })
    .toString()
    .trim();

  const contentDir = path.join(repoRoot, "src");
  const list = execSync("git ls-files src", { encoding: "utf-8" })
    .toString()
    .split("\n")
    .filter(Boolean)
    // focus on content types likely to be pages
    .filter((p) => /\.(md|cook|njk)$/.test(p));

  const map = {};
  for (const rel of list) {
    const iso = getGitLastModifiedIso(rel);
    if (!iso) continue;
    // Store multiple key variants for resilience
    const dotRel = `./${rel}`;
    map[rel] = iso;
    map[dotRel] = iso;
    map[path.join(repoRoot, rel)] = iso;
  }

  const outDir = path.join(repoRoot, "src", "data");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "fileDates.json");
  fs.writeFileSync(outFile, JSON.stringify(map, null, 2) + "\n");
  console.log(
    `Wrote ${Object.keys(map).length} entries to ${path.relative(
      repoRoot,
      outFile
    )}`
  );
}

main();
