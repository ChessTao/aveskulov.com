import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const outDir = "dist";
const rootFiles = ["index.html", "styles.css", "script.js"];
const rootAssetExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
const directories = ["assets", "best-games"];

function copyPath(source, target) {
  const stats = statSync(source);

  if (stats.isDirectory()) {
    mkdirSync(target, { recursive: true });

    for (const entry of readdirSync(source)) {
      copyPath(join(source, entry), join(target, entry));
    }

    return;
  }

  copyFileSync(source, target);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const file of rootFiles) {
  if (existsSync(file)) {
    copyPath(file, join(outDir, file));
  }
}

for (const entry of readdirSync(".")) {
  if (rootAssetExtensions.has(extname(entry).toLowerCase())) {
    copyPath(entry, join(outDir, entry));
  }
}

for (const directory of directories) {
  if (existsSync(directory)) {
    copyPath(directory, join(outDir, directory));
  }
}

if (existsSync(".openai")) {
  copyPath(".openai", join(outDir, ".openai"));
}

mkdirSync(join(outDir, "server"), { recursive: true });
writeFileSync(
  join(outDir, "server", "index.js"),
  `export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
`,
);
