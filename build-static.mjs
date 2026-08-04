import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const outDir = "dist";
const htmlTemplate = "src/index.template.html";
const rootFiles = ["styles.css", "script.js", "wrangler.jsonc"];
const rootAssetExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
const directories = ["assets", "best-games", "pictures for students page", "styles", "server"];

function normalizePgnText(text) {
  return String(text || "").replace(/^(\uFEFF|ГЇВ»Вї|РїВ»С—)/, "").replace(/\r\n/g, "\n").trim();
}

function splitMultiPgn(text) {
  const cleaned = normalizePgnText(text);
  if (!cleaned) return [];
  return cleaned.split(/\n(?=\[Event\s)/g).map((item) => item.trim()).filter(Boolean);
}

function parseHeaders(pgn) {
  const headers = {};
  const matches = pgn.matchAll(/^\[(\w+)\s+"(.*)"\]$/gm);
  for (const match of matches) headers[match[1]] = match[2];
  return headers;
}

function yearFromDate(dateStr = "") {
  const match = String(dateStr || "").match(/(\d{4})/);
  return match ? match[1] : "-";
}

function parseSortableDate(dateStr = "") {
  const match = String(dateStr || "").match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (!match) return 0;
  return Number(`${match[1]}${match[2]}${match[3]}`);
}

function parseSortableElo(value = "") {
  const num = Number(value);
  return Number.isFinite(num) ? num : -1;
}

function publicHeaders(headers) {
  return {
    Event: headers.Event || "",
    Site: headers.Site || "",
    Date: headers.Date || "",
    Result: headers.Result || "*",
    White: headers.White || "White",
    Black: headers.Black || "Black",
    WhiteElo: headers.WhiteElo || "",
    BlackElo: headers.BlackElo || ""
  };
}

function buildBestGamesData() {
  const sourcePath = "best-games/storage/games/best-games.pgn";
  const outPath = "best-games/storage/games/by-id";
  const indexPath = "best-games/storage/games/index.json";

  if (!existsSync(sourcePath)) return;

  rmSync(outPath, { recursive: true, force: true });
  mkdirSync(outPath, { recursive: true });

  const chunks = splitMultiPgn(readFileSync(sourcePath, "utf8"));
  const games = chunks.map((chunk, index) => {
    const headers = parseHeaders(chunk);
    const fileName = `game-${String(index + 1).padStart(4, "0")}.pgn`;
    const pgnPath = `storage/games/by-id/${fileName}`;

    writeFileSync(join(outPath, fileName), `${chunk}\n`);

    return {
      id: index,
      number: index + 1,
      pgnPath,
      headers: publicHeaders(headers),
      result: headers.Result || "*",
      white: headers.White || "White",
      black: headers.Black || "Black",
      whiteElo: headers.WhiteElo || "-",
      blackElo: headers.BlackElo || "-",
      event: headers.Event || "-",
      date: headers.Date || "-",
      year: yearFromDate(headers.Date || ""),
      sortDate: parseSortableDate(headers.Date || ""),
      sortWhiteElo: parseSortableElo(headers.WhiteElo || ""),
      sortBlackElo: parseSortableElo(headers.BlackElo || "")
    };
  });

  writeFileSync(indexPath, JSON.stringify({ games }));
}

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

buildBestGamesData();

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
