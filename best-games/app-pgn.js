(() => {
  function normalizePgnText(text) {
    return (text || '').replace(/^(\uFEFF|ï»¿|п»ї)/, '').replace(/\r\n/g, '\n').trim();
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

  function shortEventLabel(eventName = '') {
    const event = String(eventName || '').trim();
    if (!event) return 'No event';
    const sixDaysMatch = event.match(/^SixDays(?:\s+\w+)?\s+(\d{4})\s+GM\s*([A-Z])/i);
    if (sixDaysMatch) return `SixDays, GM-${sixDaysMatch[2].toUpperCase()}`;
    return event.replace(/\s+/g, ' ').replace(/\s*GM\s*([A-Z])\b/i, ', GM-$1');
  }

  function yearFromDate(dateStr = '') {
    const match = String(dateStr || '').match(/(\d{4})/);
    return match ? match[1] : '-';
  }

  function knownHeaderValue(value = '') {
    const text = String(value || '').trim();
    if (!text || /^\?+$/.test(text)) return '';
    return text;
  }

  function displayDate(dateStr = '') {
    const text = knownHeaderValue(dateStr);
    if (!text) return '';
    const match = text.match(/^(\d{4})(?:\.(\d{2}|\?\?))?(?:\.(\d{2}|\?\?))?$/);
    if (!match) return text.replace(/\?+/g, '').replace(/\.+$/g, '');

    const [, year, month, day] = match;
    if (!month || month === '??') return year;
    if (!day || day === '??') return `${year}.${month}`;
    return `${year}.${month}.${day}`;
  }

  function gameSubtitle(headers) {
    const parts = [
      knownHeaderValue(headers.Event) || 'No event',
      knownHeaderValue(headers.Site),
      displayDate(headers.Date),
      knownHeaderValue(headers.Result) || '*'
    ].filter(Boolean);
    return parts.join(' \u2022 ');
  }

  function parseSortableDate(dateStr = '') {
    const match = String(dateStr || '').match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
    if (!match) return 0;
    return Number(`${match[1]}${match[2]}${match[3]}`);
  }

  function parseSortableElo(value = '') {
    const num = Number(value);
    return Number.isFinite(num) ? num : -1;
  }

  function compactGameLabel(headers) {
    const white = headers.White || 'White';
    const black = headers.Black || 'Black';
    const whiteElo = headers.WhiteElo ? ` (${headers.WhiteElo})` : '';
    const blackElo = headers.BlackElo ? ` (${headers.BlackElo})` : '';
    const event = shortEventLabel(headers.Event || '');
    const year = yearFromDate(headers.Date || '');
    const result = headers.Result || '*';
    return `${white}${whiteElo}-${black}${blackElo}, ${event}, ${year}, ${result}`;
  }

  async function loadJson(source) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`JSON request failed: ${response.status}`);
    return response.json();
  }

  async function loadGameIndex(source) {
    const data = await loadJson(source);
    const games = Array.isArray(data.games) ? data.games : [];
    return games.map(createGameStub);
  }

  async function loadPgnText(source) {
    try {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`PGN request failed: ${response.status}`);
      return response.text();
    } catch (error) {
      if (typeof window.BEST_GAMES_PGN === 'string' && window.BEST_GAMES_PGN.trim()) {
        console.warn('PGN fetch failed; using embedded PGN fallback.', error);
        return window.BEST_GAMES_PGN;
      }
      throw error;
    }
  }

  function createGameStub(meta, index = 0) {
    const headers = meta.headers || {};
    return {
      id: Number.isFinite(Number(meta.id)) ? Number(meta.id) : index,
      number: Number.isFinite(Number(meta.number)) ? Number(meta.number) : index + 1,
      pgnPath: meta.pgnPath || '',
      pgn: '',
      headers,
      moves: [],
      states: [],
      isLoaded: false,
      title: `${headers.White || meta.white || 'White'}${headers.WhiteElo ? ` (${headers.WhiteElo})` : ''} - ${headers.Black || meta.black || 'Black'}${headers.BlackElo ? ` (${headers.BlackElo})` : ''}`,
      subtitle: gameSubtitle(headers),
      compactLabel: compactGameLabel(headers),
      result: meta.result || headers.Result || '*',
      white: meta.white || headers.White || 'White',
      black: meta.black || headers.Black || 'Black',
      whiteElo: meta.whiteElo || headers.WhiteElo || '-',
      blackElo: meta.blackElo || headers.BlackElo || '-',
      event: meta.event || headers.Event || '-',
      date: meta.date || headers.Date || '-',
      year: meta.year || yearFromDate(headers.Date || ''),
      sortDate: Number.isFinite(Number(meta.sortDate)) ? Number(meta.sortDate) : parseSortableDate(headers.Date || ''),
      sortWhiteElo: Number.isFinite(Number(meta.sortWhiteElo)) ? Number(meta.sortWhiteElo) : parseSortableElo(headers.WhiteElo || ''),
      sortBlackElo: Number.isFinite(Number(meta.sortBlackElo)) ? Number(meta.sortBlackElo) : parseSortableElo(headers.BlackElo || '')
    };
  }

  function parseGamePgn(chunk, fallback = {}) {
    const chess = new window.Chess();
    const ok = chess.load_pgn(chunk, { sloppy: true, newline_char: '\n' });
    if (!ok) return null;

    const headers = parseHeaders(chunk);
    const verboseMoves = chess.history({ verbose: true }) || [];
    chess.reset();
    const replay = chess;
    const states = [{ fen: replay.fen(), san: null, move: null, moveNumber: 0, from: null, to: null }];

    verboseMoves.forEach((move, moveIndex) => {
      replay.move(move);
      states.push({
        fen: replay.fen(),
        san: move.san,
        move,
        moveNumber: moveIndex + 1,
        from: move.from,
        to: move.to
      });
    });

    return {
      ...createGameStub({ ...fallback, headers }, fallback.id || 0),
      ...fallback,
      pgn: chunk,
      headers,
      moves: verboseMoves,
      states,
      isLoaded: true,
      title: `${headers.White || 'White'}${headers.WhiteElo ? ` (${headers.WhiteElo})` : ''} - ${headers.Black || 'Black'}${headers.BlackElo ? ` (${headers.BlackElo})` : ''}`,
      subtitle: gameSubtitle(headers),
      compactLabel: compactGameLabel(headers),
      result: headers.Result || '*',
      white: headers.White || 'White',
      black: headers.Black || 'Black',
      whiteElo: headers.WhiteElo || '-',
      blackElo: headers.BlackElo || '-',
      event: headers.Event || '-',
      date: headers.Date || '-',
      year: yearFromDate(headers.Date || ''),
      sortDate: parseSortableDate(headers.Date || ''),
      sortWhiteElo: parseSortableElo(headers.WhiteElo || ''),
      sortBlackElo: parseSortableElo(headers.BlackElo || '')
    };
  }

  function hydrateGame(game, pgn) {
    const parsedGame = parseGamePgn(pgn, game);
    if (!parsedGame) return null;
    Object.assign(game, parsedGame);
    return game;
  }

  function buildGames(text) {
    const chunks = splitMultiPgn(text);
    const games = [];

    chunks.forEach((chunk, index) => {
      try {
        const game = parseGamePgn(chunk, { id: index, number: index + 1 });
        if (game) games.push(game);
      } catch (error) {
        console.error('PGN parse error', error);
      }
    });

    return games;
  }

  window.appPgn = {
    buildGames,
    hydrateGame,
    loadGameIndex,
    loadPgnText
  };
})();
