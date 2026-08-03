import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const outDir = "dist";
const htmlTemplate = "src/index.template.html";
const rootFiles = ["styles.css", "script.js", "wrangler.jsonc"];
const rootAssetExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
const directories = ["assets", "best-games", "pictures for students page", "styles", "server"];

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

function buildHtml(source) {
  return source.replace(/^[ \t]*<!-- include: ([^<>:"|?*]+) -->[ \t]*$/gm, (_, includePath) => {
    const normalizedPath = includePath.trim();

    if (!existsSync(normalizedPath)) {
      throw new Error(`Missing HTML include: ${normalizedPath}`);
    }

    return readFileSync(normalizedPath, "utf8").trimEnd();
  });
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

if (existsSync(htmlTemplate)) {
  const html = buildHtml(readFileSync(htmlTemplate, "utf8"));
  writeFileSync("index.html", html);
  writeFileSync(join(outDir, "index.html"), html);
}

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

const hostingClientDir = join(outDir, "client");
mkdirSync(hostingClientDir, { recursive: true });

if (existsSync("index.html")) {
  copyPath("index.html", join(hostingClientDir, "index.html"));
}

for (const file of rootFiles) {
  if (existsSync(file)) {
    copyPath(file, join(hostingClientDir, file));
  }
}

for (const entry of readdirSync(".")) {
  if (rootAssetExtensions.has(extname(entry).toLowerCase())) {
    copyPath(entry, join(hostingClientDir, entry));
  }
}

for (const directory of directories) {
  if (existsSync(directory) && directory !== "server") {
    copyPath(directory, join(hostingClientDir, directory));
  }
}
