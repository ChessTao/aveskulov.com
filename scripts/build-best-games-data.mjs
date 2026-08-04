import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

const sourcePath = "best-games/storage/games/best-games.pgn";
const outPath = "best-games/storage/games/by-id";
const indexPath = "best-games/storage/games/index.json";

if (!existsSync(sourcePath)) {
  throw new Error(`Missing PGN source: ${sourcePath}`);
}

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
console.log(`Built ${games.length} best-games PGN files.`);
