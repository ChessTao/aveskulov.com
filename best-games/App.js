const PGN_SOURCE = 'storage/games/best-games.pgn';
const GAME_INDEX_SOURCE = 'storage/games/index.json';

const { hydrateGame, loadGameIndex, loadPgnText } = window.appPgn;
const { createPositionCache } = window.appPosition;
const { createRenderer } = window.appRender;

const PIECES = {
  p: 'vendor/pieces/cburnett/bP.svg',
  r: 'vendor/pieces/cburnett/bR.svg',
  n: 'vendor/pieces/cburnett/bN.svg',
  b: 'vendor/pieces/cburnett/bB.svg',
  q: 'vendor/pieces/cburnett/bQ.svg',
  k: 'vendor/pieces/cburnett/bK.svg',
  P: 'vendor/pieces/cburnett/wP.svg',
  R: 'vendor/pieces/cburnett/wR.svg',
  N: 'vendor/pieces/cburnett/wN.svg',
  B: 'vendor/pieces/cburnett/wB.svg',
  Q: 'vendor/pieces/cburnett/wQ.svg',
  K: 'vendor/pieces/cburnett/wK.svg'
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const boardEl = document.getElementById('board');
const appEl = document.querySelector('.app');
const boardShellEl = document.querySelector('.board-shell');
const boardResizeHandleEl = document.getElementById('boardResizeHandle');
const gamesListEl = document.getElementById('gamesList');
const gamesMenuToggleEl = document.getElementById('gamesMenuToggle');
const gamesMenuCloseEl = document.getElementById('gamesMenuClose');
const movesWrapEl = document.getElementById('movesWrap');
const boardTitleEl = document.getElementById('boardTitle');
const boardSubtitleEl = document.getElementById('boardSubtitle');
const whiteTurnDotEl = document.getElementById('whiteTurnDot');
const blackTurnDotEl = document.getElementById('blackTurnDot');
const resetAnalysisBtnEl = document.getElementById('resetAnalysisBtn');
const prevGameBtnEl = document.getElementById('prevGameBtn');
const nextGameBtnEl = document.getElementById('nextGameBtn');
const downloadMenuToggleEl = document.getElementById('downloadMenuToggle');
const downloadMenuEl = document.getElementById('downloadMenu');
const downloadGameBtnEl = document.getElementById('downloadGameBtn');
const downloadAllGamesBtnEl = document.getElementById('downloadAllGamesBtn');
const engineStateEl = document.getElementById('engineState');
const analysisPlayBtnEl = document.getElementById('analysisPlayBtn');
const analysisPauseBtnEl = document.getElementById('analysisPauseBtn');
const analysisDepthBtnEl = document.getElementById('analysisDepthBtn');
const analysisInfiniteBtnEl = document.getElementById('analysisInfiniteBtn');
const analysisLinesMinusBtnEl = document.getElementById('analysisLinesMinusBtn');
const analysisLinesPlusBtnEl = document.getElementById('analysisLinesPlusBtn');
const analysisLinesValueEl = document.getElementById('analysisLinesValue');
const evalLineEl = document.getElementById('evalLine');
const boardEvalMeterEl = document.querySelector('.board-eval-meter');
const evalMeterFillEl = document.getElementById('evalMeterFill');
const pvLineEl = document.getElementById('pvLine');
const ANALYSIS_MODES = ['depth20', 'infinite'];
const ANALYSIS_LINE_COUNTS = [1, 2, 3, 4, 5];
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const stockfish = typeof window.createStockfishController === 'function'
  ? window.createStockfishController({
      onStateChange: ({ engineStatus, engineState, evalText, evalScore, pvText }) => {
        if (engineStatus === 'error') state.engineEnabled = false;
        if (!state.engineEnabled && engineStatus && engineStatus !== 'error') {
          updateEngineControls('idle');
          return;
        }
        if (engineStatus !== undefined) updateEngineControls(engineStatus);
        if (engineState !== undefined) engineStateEl.textContent = engineState;
        if (evalText !== undefined) evalLineEl.textContent = evalText;
        if (evalScore !== undefined) updateEvalMeter(evalScore);
        if (pvText !== undefined) pvLineEl.textContent = pvText;
      }
    })
  : null;

const state = {
  games: [],
  rawPgn: '',
  gameIndex: 0,
  replayIndex: 0,
  boardSize: Number(localStorage.getItem('cm_board_size')) || null,
  sortKey: 'date',
  sortDir: 'desc',
  orientation: localStorage.getItem('cm_orientation') || 'white',
  selectedSquare: null,
  legalTargets: [],
  analysisMode: false,
  analysisBaseIndex: null,
  analysisRoot: null,
  analysisCurrentNode: null,
  analysisNodeSeq: 1,
  evalScore: null,
  lastMove: null,
  engineEnabled: false,
  analysisModeSetting: ANALYSIS_MODES.includes(localStorage.getItem('cm_analysis_mode')) ? localStorage.getItem('cm_analysis_mode') : 'depth20',
  analysisLineCount: ANALYSIS_LINE_COUNTS.includes(Number(localStorage.getItem('cm_analysis_lines'))) ? Number(localStorage.getItem('cm_analysis_lines')) : 1
};

const BOARD_MIN_SIZE = 320;
let keyboardScope = 'viewer';
const gameLoadPromises = new Map();

function setGamesMenuOpen(isOpen) {
  if (!appEl || !gamesMenuToggleEl) return;
  appEl.classList.toggle('games-list-open', isOpen);
  gamesMenuToggleEl.setAttribute('aria-expanded', String(isOpen));
}

function setDownloadMenuOpen(isOpen) {
  if (!downloadMenuToggleEl || !downloadMenuEl) return;
  downloadMenuEl.classList.toggle('open', isOpen);
  downloadMenuToggleEl.setAttribute('aria-expanded', String(isOpen));
}

function currentGame() {
  return state.games[state.gameIndex] || null;
}

function gameNumberFromIndex(index) {
  return Number(index) + 1;
}

function gameIndexFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const gameNumber = Number(params.get('game'));
  if (!Number.isInteger(gameNumber) || gameNumber < 1) return null;
  const index = gameNumber - 1;
  return state.games[index] ? index : null;
}

function updateGameUrl({ replace = false } = {}) {
  const url = new URL(window.location.href);
  url.searchParams.set('game', String(gameNumberFromIndex(state.gameIndex)));
  const method = replace ? 'replaceState' : 'pushState';
  history[method](null, '', `${url.pathname}${url.search}${url.hash}`);
}

function sanitizeFilenamePart(value, fallback = 'game') {
  const cleaned = String(value || '')
    .normalize('NFKD')
    .replace(/[^\w\s.-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ /g, '_');
  return cleaned || fallback;
}

function triggerDownload(filename, content) {
  if (!content) return;
  const blob = new Blob([content], { type: 'application/x-chess-pgn; charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
}

function currentGameFilename() {
  const game = currentGame();
  if (!game) return 'game.pgn';
  const white = sanitizeFilenamePart(game.headers.White, 'White');
  const black = sanitizeFilenamePart(game.headers.Black, 'Black');
  const date = sanitizeFilenamePart(game.headers.Date, 'undated');
  return `${white}_vs_${black}_${date}.pgn`;
}

async function downloadCurrentGame() {
  if (!currentGame()?.isLoaded) {
    try {
      await ensureGameLoaded(state.gameIndex);
    } catch (error) {
      console.error('Current game download load error', error);
      return;
    }
  }
  const game = currentGame();
  if (!game || !game.pgn) return;
  triggerDownload(currentGameFilename(), `${String(game.pgn).trim()}\n`);
}

async function downloadAllGames() {
  if (!state.rawPgn) {
    try {
      state.rawPgn = await loadPgnText(PGN_SOURCE);
    } catch (error) {
      console.error('PGN collection load error', error);
      return;
    }
  }
  triggerDownload('best-games-collection.pgn', `${String(state.rawPgn).trim()}\n`);
}

function setKeyboardScope(scope) {
  keyboardScope = scope;
}

function updateEngineControls(engineStatus = null) {
  if (!analysisPlayBtnEl || !analysisPauseBtnEl) return;
  const isBusy = state.engineEnabled && ['starting', 'searching', 'stopping', 'restarting'].includes(engineStatus);
  analysisPlayBtnEl.disabled = Boolean(state.engineEnabled && engineStatus !== 'error');
  analysisPauseBtnEl.disabled = !state.engineEnabled;
  analysisPlayBtnEl.classList.toggle('active', Boolean(state.engineEnabled));
  analysisPauseBtnEl.classList.toggle('active', Boolean(isBusy));
  analysisPlayBtnEl.setAttribute('aria-pressed', state.engineEnabled ? 'true' : 'false');
  analysisPauseBtnEl.setAttribute('aria-pressed', isBusy ? 'true' : 'false');
}

function updateEvalMeter(score) {
  if (!evalMeterFillEl) return;
  state.evalScore = Number.isFinite(score) ? score : null;
  if (boardEvalMeterEl) {
    const whiteAtBottom = state.orientation === 'white';
    boardEvalMeterEl.classList.toggle('white-bottom', whiteAtBottom);
    boardEvalMeterEl.classList.toggle('white-top', !whiteAtBottom);
  }
  if (!Number.isFinite(state.evalScore)) {
    evalMeterFillEl.style.height = '50%';
    return;
  }
  const clamped = Math.max(-6, Math.min(6, state.evalScore));
  const percent = 50 + (clamped / 12) * 100;
  evalMeterFillEl.style.height = `${Math.max(4, Math.min(96, percent))}%`;
}

function syncEvalMeterOrientation() {
  updateEvalMeter(state.evalScore);
}

function applyAnalysisMode() {
  analysisDepthBtnEl.classList.toggle('active', state.analysisModeSetting === 'depth20');
  analysisInfiniteBtnEl.classList.toggle('active', state.analysisModeSetting === 'infinite');
  analysisDepthBtnEl.setAttribute('aria-pressed', state.analysisModeSetting === 'depth20' ? 'true' : 'false');
  analysisInfiniteBtnEl.setAttribute('aria-pressed', state.analysisModeSetting === 'infinite' ? 'true' : 'false');
  localStorage.setItem('cm_analysis_mode', state.analysisModeSetting);
  if (stockfish && typeof stockfish.setMode === 'function') {
    stockfish.setMode(state.analysisModeSetting);
  }
}

function applyAnalysisLineCount() {
  analysisLinesValueEl.textContent = String(state.analysisLineCount);
  analysisLinesMinusBtnEl.disabled = state.analysisLineCount <= ANALYSIS_LINE_COUNTS[0];
  analysisLinesPlusBtnEl.disabled = state.analysisLineCount >= ANALYSIS_LINE_COUNTS[ANALYSIS_LINE_COUNTS.length - 1];
  localStorage.setItem('cm_analysis_lines', String(state.analysisLineCount));
  if (stockfish && typeof stockfish.setMultiPv === 'function') {
    stockfish.setMultiPv(state.analysisLineCount);
  }
}

function setAnalysisMode(mode) {
  if (!ANALYSIS_MODES.includes(mode) || state.analysisModeSetting === mode) return;
  state.analysisModeSetting = mode;
  applyAnalysisMode();
}

function setAnalysisLineCount(count) {
  if (!ANALYSIS_LINE_COUNTS.includes(count) || state.analysisLineCount === count) return;
  state.analysisLineCount = count;
  applyAnalysisLineCount();
}

function setEngineIdleState() {
  if (engineStateEl) {
    engineStateEl.textContent = 'Stockfish 17.1 Lite: off';
  }
  if (evalLineEl) {
    evalLineEl.textContent = 'Depth: -';
  }
  updateEvalMeter(null);
  if (pvLineEl) {
    pvLineEl.textContent = 'Press ▶ to start analysis.';
  }
  updateEngineControls('idle');
}

function requestCurrentAnalysisIfEnabled() {
  if (!state.engineEnabled) return;
  if (stockfish && typeof stockfish.requestAnalysis === 'function') {
    stockfish.requestAnalysis(positionCache.currentFen());
  }
}

function startEngineAnalysis() {
  if (!stockfish) {
    engineStateEl.textContent = 'Stockfish unavailable';
    evalLineEl.textContent = 'Depth: -';
    pvLineEl.textContent = 'Engine module not found.';
    updateEngineControls('error');
    return;
  }
  state.engineEnabled = true;
  updateEngineControls('starting');
  requestCurrentAnalysisIfEnabled();
}

function stopEngineAnalysis() {
  state.engineEnabled = false;
  if (stockfish && typeof stockfish.stopAnalysis === 'function') {
    stockfish.stopAnalysis();
  }
  setEngineIdleState();
}

const positionCache = createPositionCache({
  getCurrentFen: () => {
    if (state.analysisMode && state.analysisCurrentNode) return state.analysisCurrentNode.fen;
    const game = currentGame();
    if (!game || !game.isLoaded || !game.states[state.replayIndex]) return START_FEN;
    return game.states[state.replayIndex].fen;
  }
});

const renderer = createRenderer({
  state,
  elements: {
    boardEl,
    gamesListEl,
    movesWrapEl,
    boardTitleEl,
    boardSubtitleEl,
    whiteTurnDotEl,
    blackTurnDotEl,
    resetAnalysisBtnEl
  },
  constants: {
    PIECES,
    FILES,
    RANKS
  },
  getCurrentGame: currentGame,
  getCurrentChess: positionCache.currentChess
});

movesWrapEl.addEventListener('click', (event) => {
  const variationBtn = event.target.closest('.variation-btn[data-node-id]');
  if (!variationBtn) return;
  const node = findAnalysisNodeById(variationBtn.dataset.nodeId);
  if (!node) return;
  event.preventDefault();
  event.stopPropagation();
  goToAnalysisNode(node);
});

function boardMaxSize() {
  const panelWidth = boardShellEl.parentElement ? boardShellEl.parentElement.clientWidth - 28 : 700;
  return Math.max(BOARD_MIN_SIZE, panelWidth);
}

function clampBoardSize(size) {
  return Math.max(BOARD_MIN_SIZE, Math.min(boardMaxSize(), Math.round(size)));
}

function persistBoardSize() {
  if (state.boardSize) localStorage.setItem('cm_board_size', String(state.boardSize));
  else localStorage.removeItem('cm_board_size');
}

function applyBoardSize() {
  if (!state.boardSize) {
    boardShellEl.style.width = '';
    return;
  }
  const nextSize = clampBoardSize(state.boardSize);
  state.boardSize = nextSize;
  boardShellEl.style.width = `${nextSize}px`;
}

function beginBoardResize(event) {
  event.preventDefault();

  const pointerMove = (moveEvent) => {
    const nextSize = clampBoardSize(moveEvent.clientX - boardShellEl.getBoundingClientRect().left);
    state.boardSize = nextSize;
    applyBoardSize();
  };

  const pointerUp = () => {
    boardShellEl.classList.remove('resizing');
    persistBoardSize();
    window.removeEventListener('pointermove', pointerMove);
    window.removeEventListener('pointerup', pointerUp);
  };

  boardShellEl.classList.add('resizing');
  window.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerup', pointerUp);
}

function createAnalysisNode(parent, move, fen) {
  return { id: state.analysisNodeSeq++, parent, move, fen, children: [] };
}

function clearAnalysis() {
  state.analysisMode = false;
  state.analysisBaseIndex = null;
  state.analysisRoot = null;
  state.analysisCurrentNode = null;
}

function leaveAnalysisView() {
  state.analysisMode = false;
}

function beginAnalysisFromReplay() {
  const fen = currentGame().states[state.replayIndex].fen;
  state.analysisMode = true;
  state.analysisBaseIndex = state.replayIndex;
  state.analysisRoot = createAnalysisNode(null, null, fen);
  state.analysisCurrentNode = state.analysisRoot;
  state.lastMove = currentGame().states[state.replayIndex].move || null;
}

function goToAnalysisNode(node) {
  if (!node) return;
  state.analysisMode = true;
  state.analysisCurrentNode = node;
  state.selectedSquare = null;
  state.legalTargets = [];
  state.lastMove = node.move || currentGame().states[state.replayIndex].move || null;
  refresh();
}

function findMatchingChild(parent, move) {
  return parent.children.find((child) =>
    child.move
    && child.move.from === move.from
    && child.move.to === move.to
    && String(child.move.promotion || '') === String(move.promotion || '')
  );
}

function flattenAnalysisNodes(node, acc = []) {
  if (!node) return acc;
  acc.push(node);
  node.children.forEach((child) => flattenAnalysisNodes(child, acc));
  return acc;
}

function findAnalysisNodeById(id) {
  if (!state.analysisRoot) return null;
  return flattenAnalysisNodes(state.analysisRoot).find((node) => String(node.id) === String(id)) || null;
}

async function ensureGameLoaded(index) {
  const game = state.games[index];
  if (!game) return null;
  if (game.isLoaded) return game;
  if (gameLoadPromises.has(index)) return gameLoadPromises.get(index);

  const loadPromise = (async () => {
    const pgn = await loadPgnText(game.pgnPath);
    const loadedGame = hydrateGame(game, pgn);
    if (!loadedGame) throw new Error(`Could not parse game ${gameNumberFromIndex(index)}.`);
    return loadedGame;
  })();

  gameLoadPromises.set(index, loadPromise);

  try {
    return await loadPromise;
  } finally {
    gameLoadPromises.delete(index);
  }
}

function resetGamePosition() {
  const game = currentGame();
  state.replayIndex = 0;
  state.selectedSquare = null;
  state.legalTargets = [];
  clearAnalysis();
  state.lastMove = game && game.states[0] ? game.states[0].move || null : null;
}

function setLoadingGameHeader(game) {
  boardTitleEl.textContent = `Loading game ${gameNumberFromIndex(state.gameIndex)}...`;
  boardSubtitleEl.textContent = game ? game.subtitle : '';
  movesWrapEl.replaceChildren();
}

function setGamesSort(key) {
  if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  else {
    state.sortKey = key;
    state.sortDir = key === 'date' ? 'desc' : 'asc';
  }
  renderer.invalidateSortedGames();
  renderer.renderGamesList();
  updateGameNavButtons();
}

function selectRelativeGame(delta) {
  const orderedGames = renderer.getSortedGames();
  const currentIndex = orderedGames.findIndex((game) => game.id === state.gameIndex);
  if (currentIndex === -1) return;
  const nextIndex = Math.max(0, Math.min(currentIndex + delta, orderedGames.length - 1));
  if (nextIndex === currentIndex) return;
  void selectGame(orderedGames[nextIndex].id);
}

function updateGameNavButtons() {
  const orderedGames = renderer.getSortedGames();
  const currentIndex = orderedGames.findIndex((game) => game.id === state.gameIndex);
  const isAtStart = currentIndex <= 0;
  const isAtEnd = currentIndex === -1 || currentIndex >= orderedGames.length - 1;
  prevGameBtnEl.disabled = isAtStart;
  nextGameBtnEl.disabled = isAtEnd;
}

function goToReplay(index) {
  const game = currentGame();
  if (!game || !game.isLoaded) return;
  const hadAnalysisView = state.analysisMode;
  setKeyboardScope('viewer');
  state.replayIndex = Math.max(0, Math.min(index, game.moves.length));
  leaveAnalysisView();
  state.selectedSquare = null;
  state.legalTargets = [];
  state.lastMove = game.states[state.replayIndex].move || null;
  persistState();
  refresh({ renderMoves: hadAnalysisView });
}

async function selectGame(index, { replaceUrl = false, updateUrl = true } = {}) {
  const game = state.games[index];
  if (!game) return;

  setKeyboardScope('games');
  state.gameIndex = index;
  resetGamePosition();
  persistState();
  renderer.updateGamesSelectionState();
  updateGameNavButtons();
  setGamesMenuOpen(false);
  if (updateUrl) updateGameUrl({ replace: replaceUrl });

  if (!game.isLoaded) {
    setLoadingGameHeader(game);
  }

  try {
    await ensureGameLoaded(index);
  } catch (error) {
    console.error('Game load error', error);
    boardTitleEl.textContent = 'Game not loaded';
    boardSubtitleEl.textContent = 'Could not load this PGN file. Check generated storage/games/by-id files.';
    return;
  }

  if (state.gameIndex !== index) return;
  resetGamePosition();
  persistState();
  refresh({ renderMoves: true });
}

function legalMovesFrom(square, chess = positionCache.currentChess()) {
  return chess.moves({ square, verbose: true }) || [];
}

function onSquareClick(event) {
  if (!currentGame()?.isLoaded) return;

  const squareEl = event.target.closest('.square[data-square]');
  if (!squareEl) return;

  const sq = squareEl.dataset.square;
  const chess = positionCache.currentChess();
  const piece = chess.get(sq);

  if (state.selectedSquare) {
    const from = state.selectedSquare;
    const legal = legalMovesFrom(from, chess);
    const candidate = legal.find((move) => move.to === sq);

    if (candidate) {
      if (!state.analysisMode) beginAnalysisFromReplay();
      const parentNode = state.analysisCurrentNode;
      const analysisChess = new window.Chess(parentNode.fen);
      const playedMove = analysisChess.move({ from, to: sq, promotion: candidate.promotion || 'q' });
      let nextNode = findMatchingChild(parentNode, playedMove);

      if (!nextNode) {
        nextNode = createAnalysisNode(parentNode, playedMove, analysisChess.fen());
        parentNode.children.push(nextNode);
      }

      state.analysisCurrentNode = nextNode;
      state.lastMove = nextNode.move || null;
      state.selectedSquare = null;
      state.legalTargets = [];
      refresh();
      return;
    }
  }

  if (piece && piece.color === chess.turn()) {
    state.selectedSquare = sq;
    state.legalTargets = legalMovesFrom(sq, chess).map((move) => move.to);
  } else {
    state.selectedSquare = null;
    state.legalTargets = [];
  }

  renderer.renderBoard();
}

function persistState() {
  localStorage.setItem('cm_game_index', String(state.gameIndex));
  localStorage.setItem('cm_replay_index', String(state.replayIndex));
  localStorage.setItem('cm_orientation', state.orientation);
}

function setOpeningPosition() {
  const requestedIndex = gameIndexFromUrl();
  const firstListedGame = renderer.getSortedGames()[0];
  state.gameIndex = requestedIndex ?? (firstListedGame ? firstListedGame.id : 0);
  state.orientation = 'white';
  resetGamePosition();
  persistState();
  updateGameUrl({ replace: true });
}

function refresh({ renderMoves: shouldRenderMoves = true } = {}) {
  const game = currentGame();
  if (!game || !game.isLoaded) return;
  renderer.updateHeader();
  renderer.renderBoard();
  if (shouldRenderMoves) renderer.renderMoves();
  else renderer.updateCurrentMoveState();
  renderer.scrollCurrentMoveIntoView();
  updateGameNavButtons();
  requestCurrentAnalysisIfEnabled();
}

document.getElementById('flipBtn').addEventListener('click', () => {
  state.orientation = state.orientation === 'white' ? 'black' : 'white';
  persistState();
  syncEvalMeterOrientation();
  renderer.renderBoard();
});
prevGameBtnEl.addEventListener('click', () => {
  setKeyboardScope('games');
  selectRelativeGame(-1);
});
nextGameBtnEl.addEventListener('click', () => {
  setKeyboardScope('games');
  selectRelativeGame(1);
});
boardResizeHandleEl.addEventListener('pointerdown', beginBoardResize);
boardEl.addEventListener('click', (event) => {
  setKeyboardScope('viewer');
  onSquareClick(event);
});

if (gamesMenuToggleEl) {
  gamesMenuToggleEl.addEventListener('click', () => {
    setKeyboardScope('games');
    setGamesMenuOpen(!appEl?.classList.contains('games-list-open'));
  });
}

if (gamesMenuCloseEl) {
  gamesMenuCloseEl.addEventListener('click', () => {
    setGamesMenuOpen(false);
  });
}

movesWrapEl.addEventListener('click', (event) => {
  setKeyboardScope('viewer');
  const replayBtn = event.target.closest('.move-btn[data-replay-index]');
  if (replayBtn) {
    goToReplay(Number(replayBtn.dataset.replayIndex));
  }
});

gamesListEl.addEventListener('click', (event) => {
  setKeyboardScope('games');
  const sortBtn = event.target.closest('.table-sort-btn[data-sort-key]');
  if (sortBtn) {
    setGamesSort(sortBtn.dataset.sortKey);
    return;
  }

  const gameRow = event.target.closest('tr[data-game-id]');
  if (gameRow) {
    void selectGame(Number(gameRow.dataset.gameId));
  }
});

document.getElementById('startBtn').addEventListener('click', () => {
  setKeyboardScope('viewer');
  goToReplay(0);
});
document.getElementById('prevBtn').addEventListener('click', () => {
  setKeyboardScope('viewer');
  if (state.analysisMode && state.analysisCurrentNode && state.analysisCurrentNode.parent) {
    return goToAnalysisNode(state.analysisCurrentNode.parent);
  }
  goToReplay(state.replayIndex - 1);
});
document.getElementById('nextBtn').addEventListener('click', () => {
  setKeyboardScope('viewer');
  if (state.analysisMode && state.analysisCurrentNode && state.analysisCurrentNode.children[0]) {
    return goToAnalysisNode(state.analysisCurrentNode.children[0]);
  }
  goToReplay(state.replayIndex + 1);
});
document.getElementById('endBtn').addEventListener('click', () => {
  setKeyboardScope('viewer');
  if (state.analysisMode && state.analysisCurrentNode) {
    let node = state.analysisCurrentNode;
    while (node.children[0]) node = node.children[0];
    return goToAnalysisNode(node);
  }
  goToReplay(currentGame().moves.length);
});
document.getElementById('resetAnalysisBtn').addEventListener('click', () => {
  setKeyboardScope('viewer');
  const target = state.analysisBaseIndex !== null ? state.analysisBaseIndex : state.replayIndex;
  goToReplay(target);
});
document.getElementById('copyFenBtn').addEventListener('click', async () => {
  const fen = positionCache.currentFen();
  try {
    await navigator.clipboard.writeText(fen);
  } catch (_) {}
});
if (downloadMenuToggleEl) {
  downloadMenuToggleEl.addEventListener('click', (event) => {
    event.stopPropagation();
    setDownloadMenuOpen(!downloadMenuEl?.classList.contains('open'));
  });
}
downloadGameBtnEl.addEventListener('click', () => {
  void downloadCurrentGame();
  setDownloadMenuOpen(false);
});
downloadAllGamesBtnEl.addEventListener('click', () => {
  void downloadAllGames();
  setDownloadMenuOpen(false);
});
analysisDepthBtnEl.addEventListener('click', () => {
  setAnalysisMode('depth20');
});
analysisInfiniteBtnEl.addEventListener('click', () => {
  setAnalysisMode('infinite');
});
analysisPlayBtnEl.addEventListener('click', () => {
  startEngineAnalysis();
});
analysisLinesMinusBtnEl.addEventListener('click', () => {
  setAnalysisLineCount(state.analysisLineCount - 1);
});
analysisLinesPlusBtnEl.addEventListener('click', () => {
  setAnalysisLineCount(state.analysisLineCount + 1);
});
analysisPauseBtnEl.addEventListener('click', () => {
  stopEngineAnalysis();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setGamesMenuOpen(false);
    setDownloadMenuOpen(false);
  }

  if (keyboardScope === 'games') {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectRelativeGame(-1);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectRelativeGame(1);
      return;
    }
  }

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
  }

  if (state.analysisMode && state.analysisCurrentNode) {
    if (event.key === 'ArrowLeft' && state.analysisCurrentNode.parent) return goToAnalysisNode(state.analysisCurrentNode.parent);
    if (event.key === 'ArrowRight' && state.analysisCurrentNode.children[0]) return goToAnalysisNode(state.analysisCurrentNode.children[0]);
    if (event.key === 'Home') return goToAnalysisNode(state.analysisRoot);
    if (event.key === 'End') {
      let node = state.analysisCurrentNode;
      while (node.children[0]) node = node.children[0];
      return goToAnalysisNode(node);
    }
  }

  if (event.key === 'ArrowLeft') goToReplay(state.replayIndex - 1);
  if (event.key === 'ArrowRight') goToReplay(state.replayIndex + 1);
  if (event.key === 'Home') goToReplay(0);
  if (event.key === 'End') goToReplay(currentGame().moves.length);
});

window.addEventListener('click', (event) => {
  if (!downloadMenuEl?.classList.contains('open')) return;
  if (event.target.closest('.download-menu-wrap')) return;
  setDownloadMenuOpen(false);
});

window.addEventListener('resize', () => {
  if (!state.boardSize) return;
  applyBoardSize();
});

window.addEventListener('popstate', () => {
  const index = gameIndexFromUrl();
  if (index === null || index === state.gameIndex) return;
  void selectGame(index, { updateUrl: false });
});

window.addEventListener('pageshow', () => {
  renderer.repairBoardImages();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') renderer.repairBoardImages();
});

async function boot() {
  if (downloadMenuToggleEl) downloadMenuToggleEl.disabled = true;
  downloadGameBtnEl.disabled = true;
  downloadAllGamesBtnEl.disabled = true;
  renderer.preloadPieces();
  applyBoardSize();
  syncEvalMeterOrientation();
  renderer.renderBoard();

  if (stockfish && typeof stockfish.getModelLabel === 'function') {
    setEngineIdleState();
  } else {
    engineStateEl.textContent = 'Stockfish 17.1 Lite';
    updateEngineControls('idle');
  }
  applyAnalysisMode();
  applyAnalysisLineCount();

  if (typeof window.Chess !== 'function') {
    boardTitleEl.textContent = 'chess.js failed to load';
    boardSubtitleEl.textContent = 'Check vendor/chess/chess-0.10.3.min.js: the browser cannot parse PGN without this library.';
    return;
  }

  try {
    state.games = await loadGameIndex(GAME_INDEX_SOURCE);
  } catch (error) {
    console.error('Game index load error', error);
    boardTitleEl.textContent = 'Games not loaded';
    boardSubtitleEl.textContent = 'Could not load the games index. Run npm run build to generate storage/games/index.json.';
    return;
  }

  if (!state.games.length) {
    boardTitleEl.textContent = 'No games found';
    boardSubtitleEl.textContent = 'The games index loaded, but it does not contain any games.';
    return;
  }

  applyBoardSize();
  setOpeningPosition();
  renderer.renderGamesList();
  setLoadingGameHeader(currentGame());

  try {
    await ensureGameLoaded(state.gameIndex);
  } catch (error) {
    console.error('Initial game load error', error);
    boardTitleEl.textContent = 'Game not loaded';
    boardSubtitleEl.textContent = 'Could not load the selected PGN file.';
    return;
  }

  if (downloadMenuToggleEl) downloadMenuToggleEl.disabled = false;
  downloadGameBtnEl.disabled = false;
  downloadAllGamesBtnEl.disabled = false;
  resetGamePosition();
  refresh();
}

boot();
