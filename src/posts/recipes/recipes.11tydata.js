const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

let attemptedUnshallow = false;
function ensureFullGitHistory() {
  if (attemptedUnshallow) return;
  attemptedUnshallow = true;
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
          execSync("git fetch --unshallow --tags --prune", { stdio: "ignore" });
        } catch {}
      }
    }
  } catch {}
}

function getGitCreatedIsoForFile(inputPath) {
  try {
    const iso = execSync(
      `git log --diff-filter=A --follow --format=%aI -1 -- ${JSON.stringify(
        inputPath
      )}`,
      { encoding: "utf-8" }
    )
      .toString()
      .trim();
    return iso || null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  eleventyComputed: {
    date: (data) => {
      if (data.date) return data.date;

      const inputPath = data?.page?.inputPath;
      if (!inputPath) return data.page?.date;

      // Precomputed map first
      try {
        const projectRoot = path.resolve(__dirname, "../../..");
        const mapPath = path.join(projectRoot, "src", "data", "fileDates.json");
        if (fs.existsSync(mapPath)) {
          const map = JSON.parse(fs.readFileSync(mapPath, "utf-8"));
          const iso =
            map[inputPath] ||
            map[inputPath.replace(/^\.\//, "")] ||
            map[path.resolve(inputPath)];
          if (iso) return new Date(iso);
        }
      } catch {}

      // Git first commit date
      ensureFullGitHistory();
      const gitIso = getGitCreatedIsoForFile(inputPath);
      if (gitIso) return new Date(gitIso);

      // Filesystem fallback
      try {
        const stat = fs.statSync(inputPath);
        return stat.birthtimeMs
          ? new Date(stat.birthtimeMs)
          : new Date(stat.mtimeMs);
      } catch (e) {
        return data.page?.date;
      }
    },
  },
};
