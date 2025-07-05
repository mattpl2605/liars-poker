const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

/* 1️⃣  FRONT-END ORIGIN
   -------------------------------------------------
   • in production you'll set FRONTEND_ORIGIN
     on Railway → Variables (value = your Vercel URL)
   • when you run locally it falls back to localhost:3000
*/
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

/* ------------------------------------------------- */

const app = express();
const server = http.createServer(app);

// Helper to evaluate if a request origin is allowed
const corsOriginFn = (origin, callback) => {
  // Allow requests with no origin (like mobile apps or curl)
  if (!origin) return callback(null, true);
  const allowed =
    origin === FRONTEND_ORIGIN || // explicit env origin
    /\.vercel\.app$/.test(origin); // any Vercel preview/production domain
  if (allowed) {
    return callback(null, true);
  }
  return callback(new Error('Not allowed by CORS'));
};

/* 2️⃣  Socket.IO CORS */
const io = new Server(server, {
  cors: {
    origin: "*", // Temporarily allow all origins for debugging
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  }
});

/* 3️⃣  Express CORS (for GET / health-check) */
app.use(
  cors({
    origin: corsOriginFn,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Additional CORS headers for Socket.IO
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "1800");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  res.setHeader("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, PATCH, OPTIONS");
  next();
});

const PORT = process.env.PORT || 4000;

// In-memory game rooms
const games = {};

// Helper to create a deck
function createDeck() {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

// Shuffle helper
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const RANK_VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const HAND_RANKINGS = ['high_card','pair','two_pair','three_of_a_kind','straight','flush','full_house','four_of_a_kind','straight_flush','royal_flush'];

function cardValue(rank) {
  return RANK_VALUES.indexOf(rank);
}

function getCountsByRank(cards) {
  const counts = {};
  cards.forEach(c => {
    counts[c.rank] = (counts[c.rank] || 0) + 1;
  });
  return counts;
}

function hasStraight(cardList) {
  const uniqueVals = [...new Set(cardList.map(c => cardValue(c.rank)))].sort((a,b) => a - b);
  if (uniqueVals.includes(12)) { // Ace high can also be low
    uniqueVals.unshift(-1);
  }
  let consec = 1;
  for (let i = 1; i < uniqueVals.length; i++) {
    consec = uniqueVals[i] === uniqueVals[i - 1] + 1 ? consec + 1 : 1;
    if (consec >= 5) return true;
  }
  return false;
}

function getBestHand(cards) {
  // Flush lookup
  const suitsMap = {};
  cards.forEach(c => {
    suitsMap[c.suit] = (suitsMap[c.suit] || []).concat(c);
  });
  const flushSuitCards = Object.values(suitsMap).find(arr => arr.length >= 5);

  const rankCounts = Object.values(getCountsByRank(cards));
  const pairs = rankCounts.filter(c => c === 2).length;
  const threes = rankCounts.filter(c => c === 3).length;
  const fours = rankCounts.filter(c => c === 4).length;

  const isStraight = hasStraight(cards);
  const isFlush = !!flushSuitCards;

  let isStraightFlush = false;
  let isRoyal = false;
  if (isFlush) {
    isStraightFlush = hasStraight(flushSuitCards);
    if (isStraightFlush) {
      const flushVals = flushSuitCards.map(c => cardValue(c.rank));
      isRoyal = ['10','J','Q','K','A'].every(r => flushVals.includes(cardValue(r)));
    }
  }

  if (isRoyal) return 'royal_flush';
  if (isStraightFlush) return 'straight_flush';
  if (fours) return 'four_of_a_kind';
  if (threes && pairs) return 'full_house';
  if (isFlush) return 'flush';
  if (isStraight) return 'straight';
  if (threes) return 'three_of_a_kind';
  if (pairs >= 2) return 'two_pair';
  if (pairs === 1) return 'pair';
  return 'high_card';
}

// Helper to parse a claim string into structured data
function parseClaimString(str) {
  if (!str) return null;
  const lc = str.toLowerCase();
  const rankFromWord = (word) => {
    return word.replace(/s$/,'').toUpperCase();
  };
  // Detect implicit Full House pattern e.g. "As over 10s" or "Queens over 2s"
  const fhImplicit = str.match(/([0-9A-Za-z]+)s over ([0-9A-Za-z]+)s/i);
  if (fhImplicit) {
    const r1 = rankFromWord(fhImplicit[1]);
    const r2 = rankFromWord(fhImplicit[2]);
    if (r1 !== r2) {
      return { category: 'full_house', rank: r1, pairRank: r2 };
    }
  }
  // Existing explicit Full House detection using keyword
  if (lc.includes('full house')) {
    const match = str.match(/([0-9A-Za-z]+)s over ([0-9A-Za-z]+)s/i);
    if (match) {
      return { category: 'full_house', rank: rankFromWord(match[1]), pairRank: rankFromWord(match[2]) };
    }
  }
  // Handle "Two Pair" BEFORE generic "Pair" to avoid false matches for strings
  // like "Two Pair of 7s and 6s" which also contain "pair of".
  if (lc.includes('two pair')) {
    const match = str.match(/Two Pair of ([0-9A-Za-z]+)s and ([0-9A-Za-z]+)s/i);
    if (match) {
      const r1 = rankFromWord(match[1]);
      const r2 = rankFromWord(match[2]);
      const high = cardValue(r1) >= cardValue(r2) ? r1 : r2;
      const low = high === r1 ? r2 : r1;
      return { category: 'two_pair', rank: high, secondRank: low };
    }
    return { category: 'two_pair', rank: null, secondRank: null };
  }
  // Generic "Pair" (must come AFTER the two-pair branch above)
  if (lc.includes('pair of')) {
    const rank = rankFromWord(str.split('Pair of ')[1]);
    return { category: 'pair', rank };
  }
  if (lc.includes('three of a kind')) {
    const match=str.match(/Three of a Kind of ([0-9A-Za-z]+)s/i);
    const rank = match? rankFromWord(match[1]) : null;
    return { category: 'three_of_a_kind', rank };
  }
  if (lc.includes('four of a kind')) {
    const match=str.match(/Four of a Kind of ([0-9A-Za-z]+)s/i);
    const rank = match? rankFromWord(match[1]) : null;
    return { category: 'four_of_a_kind', rank };
  }
  if (lc.includes('-high straight')) {
    const rank = rankFromWord(str.split('-high')[0]);
    return { category: 'straight', rank };
  }
  if (lc.includes('-high') && lc.includes('flush')) {
    // pattern: "Q-high hearts flush" or "Q-high hearts straight flush"
    const parts = str.split('-high ');
    const rankPart = parts[0];
    const rest = parts[1];
    const suitMatch = rest.match(/(Hearts|Diamonds|Clubs|Spades)/i);
    const suit = suitMatch ? suitMatch[1].toLowerCase() : null;
    if(rest.toLowerCase().includes('straight flush')){
      return { category: 'straight_flush', rank: rankFromWord(rankPart), suit };
    }
    return { category: 'flush', rank: rankFromWord(rankPart), suit };
  }
  if (lc.includes('-high card')) {
    const rank = rankFromWord(str.split('-high')[0]);
    return { category: 'high_card', rank };
  }
  // Handle claims like "Ace-high" or "Q-high" that omit the trailing word
  if (lc.includes('-high') && !lc.includes('straight') && !lc.includes('flush')) {
    const rank = rankFromWord(str.split('-high')[0]);
    return { category: 'high_card', rank };
  }
  if (lc.includes('straight flush')) {
    return { category: 'straight_flush' };
  }
  if (lc.includes('royal flush')) {
    const suitMatch = str.match(/(Hearts|Diamonds|Clubs|Spades)/i);
    const suit = suitMatch ? suitMatch[1].toLowerCase() : null;
    return { category: 'royal_flush', suit };
  }
  return null;
}

function getHighestPair(cards) {
  const counts = getCountsByRank(cards);
  const pairs = Object.keys(counts).filter(r => counts[r] >= 2);
  if (pairs.length === 0) return null;
  return pairs.sort((a,b) => cardValue(b) - cardValue(a))[0];
}

function getTwoPairHigh(cards) {
  const counts = getCountsByRank(cards);
  const pairs = Object.keys(counts).filter(r => counts[r] >= 2).sort((a,b)=>cardValue(b)-cardValue(a));
  return pairs.length>=2 ? pairs[0] : null;
}

function getTripsRank(cards){
  const counts = getCountsByRank(cards);
  const trips = Object.keys(counts).filter(r=>counts[r]>=3).sort((a,b)=>cardValue(b)-cardValue(a));
  return trips[0] || null;
}

function getQuadsRank(cards){
  const counts = getCountsByRank(cards);
  const quads = Object.keys(counts).filter(r=>counts[r]>=4).sort((a,b)=>cardValue(b)-cardValue(a));
  return quads[0] || null;
}

function getFullHouseRanks(cards){
  const counts = getCountsByRank(cards);
  const trips = Object.keys(counts).filter(r=>counts[r]>=3).sort((a,b)=>cardValue(b)-cardValue(a));
  const pairs = Object.keys(counts).filter(r=>counts[r]>=2 && r!==trips[0]).sort((a,b)=>cardValue(b)-cardValue(a));
  if (trips.length && pairs.length) return {trip: trips[0], pair: pairs[0]};
  return null;
}

function getHighestCard(cards){
  return cards.sort((a,b)=>cardValue(b.rank)-cardValue(a.rank))[0]?.rank || null;
}

function getStraightHigh(cards){
  const vals=[...new Set(cards.map(c=>cardValue(c.rank)))].sort((a,b)=>a-b);
  if (vals.includes(12)) vals.unshift(-1); // Ace low
  let consec=1;
  let bestHigh=null;
  for(let i=1;i<vals.length;i++){
    if(vals[i]===vals[i-1]+1){
      consec++;
      if(consec>=5) bestHigh=vals[i];
    }else{
      consec=1;
    }
  }
  return bestHigh!==null?RANK_VALUES[bestHigh<0?12:bestHigh]:null;
}

// Check if a straight exists whose HIGHEST card is exactly the specified rank.
function straightExistsWithHigh(cards, highRank) {
  if (!highRank) return false;
  // Special wheel straight (5-high): 5,4,3,2,A
  if (highRank === '5') {
    const needed = ['5','4','3','2','A'];
    return needed.every(r => cards.some(c => c.rank === r));
  }

  const highIdx = RANK_VALUES.indexOf(highRank);
  if (highIdx < 4) return false; // Cannot form a straight of length 5

  // Collect the 5 consecutive ranks ending at highIdx
  const neededRanks = RANK_VALUES.slice(highIdx - 4, highIdx + 1);
  return neededRanks.every(r => cards.some(c => c.rank === r));
}

// Check if a flush exists in the given suit (if specified) whose highest
// card is exactly the provided rank.
function flushExistsWithHigh(cards, highRank, suit = null) {
  if (!highRank) return false;
  const suitsToCheck = suit ? [suit] : ['clubs', 'diamonds', 'hearts', 'spades'];
  const targetVal = cardValue(highRank);
  for (const s of suitsToCheck) {
    const suited = cards.filter(c => c.suit === s);
    if (suited.length < 5) continue;
    const highest = suited.reduce((prev, cur) => (cardValue(cur.rank) > cardValue(prev.rank) ? cur : prev), suited[0]);
    if (cardValue(highest.rank) === targetVal) return true;
  }
  return false;
}

// Check if a straight flush exists whose highest card matches highRank.
function straightFlushExistsWithHigh(cards, highRank, suit = null) {
  if (!highRank) return false;
  const suitsToCheck = suit ? [suit] : ['clubs', 'diamonds', 'hearts', 'spades'];
  for (const s of suitsToCheck) {
    const suited = cards.filter(c => c.suit === s);
    if (suited.length < 5) continue;
    // Convert to set of ranks present in this suit
    const rankSet = new Set(suited.map(c => c.rank));
    if (highRank === '5') {
      const wheel = ['5','4','3','2','A'];
      if (wheel.every(r => rankSet.has(r))) return true;
      continue;
    }
    const highIdx = RANK_VALUES.indexOf(highRank);
    if (highIdx < 4) continue;
    const needed = RANK_VALUES.slice(highIdx - 4, highIdx + 1);
    if (needed.every(r => rankSet.has(r))) return true;
  }
  return false;
}

// Check if a royal flush (10-J-Q-K-A) exists in the specified suit (or any
// suit if none specified).
function royalFlushExists(cards, suit = null) {
  const royalRanks = ['10', 'J', 'Q', 'K', 'A'];
  const suitsToCheck = suit ? [suit] : ['clubs', 'diamonds', 'hearts', 'spades'];
  for (const s of suitsToCheck) {
    const hasAll = royalRanks.every(r => cards.some(c => c.suit === s && c.rank === r));
    if (hasAll) return true;
  }
  return false;
}

function isClaimValid(claimStr, cards) {
  const parsed = parseClaimString(claimStr);
  if (!parsed) return false;

  // New logic for High Card claims: the claim is valid if and only if
  // there is EXACTLY one card of the claimed rank among the provided cards.
  // We evaluate this independently from the overall best-hand category because
  // pairs, trips, etc. might also be present, yet the high-card claim only
  // concerns the unique count of that specific rank.
  if (parsed.category === 'high_card') {
    if (!parsed.rank) return false;
    const counts = getCountsByRank(cards);
    return (counts[parsed.rank] || 0) >= 1;
  }

  // New logic for Pair claims: the claim is valid if and only if
  // there are EXACTLY two cards of the claimed rank among the provided cards.
  if (parsed.category === 'pair') {
    if (!parsed.rank) return false;
    const counts = getCountsByRank(cards);
    return (counts[parsed.rank] || 0) >= 2;
  }

  // New logic for Two Pair claims: the claim is valid iff there are
  // EXACTLY two cards of EACH of the two claimed ranks. No more, no less.
  if (parsed.category === 'two_pair') {
    if (!parsed.rank || !parsed.secondRank || parsed.rank === parsed.secondRank) {
      // malformed claim; allow detailed logic below to catch invalidity
    } else {
      const counts = getCountsByRank(cards);
      if ((counts[parsed.rank] || 0) >= 2 && (counts[parsed.secondRank] || 0) >= 2) {
        return true; // quick positive validation
      }
      // If quick check fails, fall through to comprehensive comparison below
    }

    const counts = getCountsByRank(cards);
    const pairs = Object.keys(counts).filter(r => counts[r] >= 2).sort((a, b) => cardValue(b) - cardValue(a));

    if (pairs.length < 2) return false;

    const highActual = pairs[0];
    const lowActual = pairs[1];
    const highClaimed = parsed.rank;
    const lowClaimed = parsed.secondRank;

    if (cardValue(highActual) > cardValue(highClaimed)) return true;
    if (cardValue(highActual) === cardValue(highClaimed) && cardValue(lowActual) >= cardValue(lowClaimed)) return true;

    return false;
  }

  // New logic for Three of a Kind claims: valid if there are AT LEAST three
  // cards of the claimed rank among the revealed cards.
  if (parsed.category === 'three_of_a_kind') {
    if (!parsed.rank) return false;
    const counts = getCountsByRank(cards);
    return (counts[parsed.rank] || 0) >= 3;
  }

  // New logic for Four of a Kind claims: need at least four of the claimed rank.
  if (parsed.category === 'four_of_a_kind') {
    if (!parsed.rank) return false;
    const counts = getCountsByRank(cards);
    return (counts[parsed.rank] || 0) >= 4;
  }

  // New logic for Straight claims: verify that a straight exists whose
  // highest card matches the claimed rank (wheel handled inside helper).
  if (parsed.category === 'straight') {
    if (!parsed.rank) return false;
    return straightExistsWithHigh(cards, parsed.rank);
  }

  // New logic for Flush claims: must have at least 5 cards of the suit (if
  // specified) and the highest card in that suit must match the claimed rank.
  if (parsed.category === 'flush') {
    if (!parsed.rank) return false;
    return flushExistsWithHigh(cards, parsed.rank, parsed.suit);
  }

  // New logic for Straight Flush claims: need a straight flush with the
  // specified high rank and (optional) suit.
  if (parsed.category === 'straight_flush') {
    if (!parsed.rank) return false;
    return straightFlushExistsWithHigh(cards, parsed.rank, parsed.suit);
  }

  // New logic for Full House claims: need at least three of the trip rank
  // and at least two of the pair rank (if specified) among all revealed cards.
  if (parsed.category === 'full_house') {
    if (!parsed.rank || !parsed.pairRank || parsed.rank === parsed.pairRank) return false;
    const counts = getCountsByRank(cards);
    return (counts[parsed.rank] || 0) >= 3 && (counts[parsed.pairRank] || 0) >= 2;
  }

  // New logic for Royal Flush claims: need a royal flush with the
  // specified suit (if specified) or in any suit if none specified.
  if (parsed.category === 'royal_flush') {
    if (!parsed.suit) return false; // Royal flush requires a suit
    return royalFlushExists(cards, parsed.suit);
  }

  const actualCategory = getBestHand(cards);
  const claimedCategoryIndex = HAND_RANKINGS.indexOf(parsed.category);
  const actualCategoryIndex = HAND_RANKINGS.indexOf(actualCategory);

  // Claim is only valid if actual best hand is in the SAME category.
  if (actualCategoryIndex !== claimedCategoryIndex) return false;

  // Equal category, compare specifics
  switch(parsed.category){
    case 'pair': {
      const highestPair = getHighestPair(cards);
      if(!highestPair) return false;
      return cardValue(highestPair) >= cardValue(parsed.rank);
    }
    case 'two_pair': {
      if (!parsed.rank || !parsed.secondRank) return false; // Malformed claim

      const counts = getCountsByRank(cards);
      const pairs = Object.keys(counts).filter(r => counts[r] >= 2).sort((a, b) => cardValue(b) - cardValue(a));

      if (pairs.length < 2) return false;

      const highActual = pairs[0];
      const lowActual = pairs[1];
      const highClaimed = parsed.rank;
      const lowClaimed = parsed.secondRank;

      if (cardValue(highActual) > cardValue(highClaimed)) return true;
      if (cardValue(highActual) === cardValue(highClaimed) && cardValue(lowActual) >= cardValue(lowClaimed)) return true;

      return false;
    }
    case 'three_of_a_kind': {
      const trips = getTripsRank(cards);
      return trips && cardValue(trips) >= cardValue(parsed.rank);
    }
    case 'four_of_a_kind': {
      const quads = getQuadsRank(cards);
      return quads && cardValue(quads) >= cardValue(parsed.rank);
    }
    case 'full_house': {
      const fh = getFullHouseRanks(cards);
      if(!fh) return false;
      const tripOk = cardValue(fh.trip) >= cardValue(parsed.rank);
      if(!tripOk) return false;
      if(parsed.pairRank){
        return cardValue(fh.trip) > cardValue(parsed.rank) || cardValue(fh.pair) >= cardValue(parsed.pairRank);
      }
      return true;
    }
    case 'straight': {
      const high = getStraightHigh(cards);
      return high && cardValue(high) >= cardValue(parsed.rank);
    }
    case 'flush': {
       // Need flush in same suit (if suit specified) and high card >= rank
       const suitsMap = {};
       cards.forEach(c=>{suitsMap[c.suit]=(suitsMap[c.suit]||[]).concat(c);});
       const suitCards = parsed.suit ? (suitsMap[parsed.suit]||[]) : Object.values(suitsMap).find(a=>a.length>=5) || [];
       if(suitCards.length<5) return false;
       const high = getHighestCard(suitCards);
       return high && cardValue(high) >= cardValue(parsed.rank);
    }
    case 'high_card': {
      const high = getHighestCard(cards);
      return high && cardValue(high) >= cardValue(parsed.rank);
    }
    case 'straight_flush': {
       const suit = parsed.suit;
       const suitsToCheck = suit? [suit]: Object.keys(getCountsByRank(cards));
       let foundHigh=null;
       for(const s of suitsToCheck){
          const suited = cards.filter(c=>c.suit===s);
          if(suited.length<5) continue;
          const high = getStraightHigh(suited);
          if(high) foundHigh = RANK_VALUES.indexOf(high) > RANK_VALUES.indexOf(foundHigh||'2') ? high : foundHigh;
       }
       return !!foundHigh && (!parsed.rank || cardValue(foundHigh)>=cardValue(parsed.rank));
    }
    case 'royal_flush': {
       const suit = parsed.suit;
       const royalRanks = ['10','J','Q','K','A'];
       const suitsToCheck = suit? [suit]: ['hearts','diamonds','clubs','spades'];
       for(const s of suitsToCheck){
          const hasAll = royalRanks.every(r=>cards.some(c=>c.suit===s && c.rank===r));
          if(hasAll) return true;
       }
       return false;
    }
    default:
      return true; // categories like straight_flush already covered
  }
}

function dealNewRound(game) {
  const deck = shuffle(createDeck());
  const communityCards = deck.splice(0, 5);
  const playerCards = {};

  // Only active players (isActive !== false) receive new cards
  game.players.forEach((p) => {
    if (p.isActive === false) {
      // Explicitly set empty array for clarity / UI
      playerCards[p.id] = [];
      return;
    }
    const handSize = 2 + (p.extraCards || 0);
    playerCards[p.id] = deck.splice(0, handSize);
  });
  const dealer = game.players.find(p => p.isDealer) || game.players[0];
  const currentTurn = dealer.id;
  game.state = {
    players: game.players,
    communityCards,
    playerCards,
    currentClaim: null,
    currentClaimerId: null,
    currentTurn,
    roundStarter: currentTurn,
    phase: 'playing',
    revealedCards: [false, false, false, false, false],
    gameStarted: true,
    gameRound: 0,
  };
}

io.on('connection', (socket) => {
  // Create a new game
  socket.on('createGame', ({ playerName }, callback) => {
    const gameCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    games[gameCode] = {
      players: [{ id: socket.id, name: playerName, isHost: true, extraCards: 0, isDealer: true }],
    };
    socket.join(gameCode);
    callback({ gameCode, players: games[gameCode].players });
    io.to(gameCode).emit('playerList', games[gameCode].players);
  });

  // Join an existing game
  socket.on('joinGame', ({ gameCode, playerName }, callback) => {
    const game = games[gameCode];
    if (!game) {
      callback({ error: 'Game not found' });
      return;
    }

    if (game.state && game.state.gameStarted) {
      callback({ error: 'Game is already in progress.' });
      return;
    }

    // Prevent duplicate players
    if (!game.players.some(p => p.id === socket.id)) {
      game.players.push({ id: socket.id, name: playerName, isHost: false, extraCards: 0, isDealer: false });
    }
    socket.join(gameCode);
    callback({ gameCode, players: game.players });
    io.to(gameCode).emit('playerList', game.players);
    // If the game has already started, send the current game state to the new player
    if (game.state) {
      socket.emit('gameState', game.state);
    }
  });

  // Handle player disconnecting/leaving game
  socket.on('disconnect', () => {
    Object.entries(games).forEach(([code, game]) => {
      const playerIdx = game.players.findIndex(p => p.id === socket.id);
      if (playerIdx === -1) return;

      const removedPlayer = game.players[playerIdx];
      const removedId = removedPlayer.id;

      // Remove player
      game.players.splice(playerIdx, 1);
      if (game.state) {
        game.state.players = game.state.players.filter(p => p.id !== removedId);
        if (game.state.playerCards) {
          delete game.state.playerCards[removedId];
        }
      }

      // If no players left, cleanup game
      if (game.players.length === 0) {
        delete games[code];
        return;
      }

      // If game is running
      if (game.state) {
        // Advance turn if the disconnected player was up
        if (game.state.currentTurn === removedId) {
          const nextPlayerId = getNextActivePlayer(game, removedId, playerIdx);
          game.state.currentTurn = nextPlayerId;
          if(game.state.roundStarter === removedId) {
            game.state.roundStarter = nextPlayerId;
          }
        }

        // If disconnected player was the dealer, assign to next player
        if (removedPlayer.isDealer && game.players.length > 0) {
            const nextDealerId = getNextActivePlayer(game, removedId, playerIdx);
            if (nextDealerId) {
              const nextDealer = game.players.find(p => p.id === nextDealerId);
              if (nextDealer) nextDealer.isDealer = true;
            } else {
               game.players[0].isDealer = true;
            }
        }

        // Promote new host if host left
        if (removedPlayer.isHost && game.players.length > 0) {
          game.players[0].isHost = true;
        }

        // Handle BS reveal phase
        if (game.state.phase === 'bs-reveal' && game.state.continues) {
          game.state.continues.delete(removedId);
          // After a player leaves, check if we can proceed
          const activePlayers = game.players.filter(p => p.isActive !== false);
          if (game.state.continues.size >= activePlayers.length) {
            // All remaining players have acknowledged, proceed to next round
            delete game.state.continues;
            dealNewRound(game);
            io.to(code).emit('gameState', game.state);
            return; // Exit to avoid double-sending state
          }
        }
        
        // Check for winner
        const activePlayersNow = game.players.filter(p => (p.extraCards || 0) + 2 < 6);
        if (game.players.length > 0 && activePlayersNow.length <= 1) {
          const ranking = game.players.map(p => ({
            id: p.id,
            name: p.name,
            cardCount: (game.state.playerCards && game.state.playerCards[p.id]?.length) || (p.extraCards || 0) + 2,
          })).sort((a, b) => a.cardCount - b.cardCount);
          ranking.forEach((p, idx) => { p.placement = idx + 1 });

          io.to(code).emit('gameEnded', { players: ranking, gameCode: code });
          // Don't delete game state, allows viewing final board
        } else {
          // Broadcast updated state to all clients
          io.to(code).emit('gameState', game.state);
        }
      }
      
      // Always broadcast player list on disconnect
      io.to(code).emit('playerList', game.players);
    });
  });

  // Start game event
  socket.on('startGame', ({ gameCode }) => {
    const game = games[gameCode];
    if (!game) return;

    // Require at least 2 players
    if (game.players.length < 2) {
      socket.emit('error', 'Need at least 2 players to start the game');
      return;
    }

    // Setup game state
    dealNewRound(game);
    io.to(gameCode).emit('gameState', game.state);
  });

  // Helper to get next active player
  function getNextActivePlayer(game, currentTurnId, disconnectedPlayerIndex = -1) {
    const players = game.state.players;
    const getPlayerCardCount = (pId) => (game.state.playerCards[pId]?.length || 0);
    
    if (players.length === 0) return null;

    const activePlayers = players.filter(p => getPlayerCardCount(p.id) < 6);
    if (activePlayers.length === 0) return null;
    if (activePlayers.length === 1) return activePlayers[0].id;

    let startIdx = players.findIndex(p => p.id === currentTurnId);
    if (startIdx === -1) {
      // Player not found, likely disconnected. The next player is now at the
      // disconnected player's index. We start the search from one *before*
      // that index, so the loop's +1 lands on the correct player.
      startIdx = disconnectedPlayerIndex - 1;
    }

    // Loop through players to find the NEXT available one.
    for (let i = 1; i <= players.length; i++) {
      const pIdx = (startIdx + i + players.length) % players.length;
      const player = players[pIdx];
      if (getPlayerCardCount(player.id) < 6) {
        return player.id;
      }
    }
    
    return null; // Should not be reached
  }
  
  // Make claim event
  socket.on('makeClaim', ({ gameCode, claim }) => {
    const game = games[gameCode];
    if (!game || !game.state) return;
    game.state.currentClaim = claim;
    game.state.currentClaimerId = socket.id;
    
    // Advance turn to the next active player
    const nextTurnId = getNextActivePlayer(game, game.state.currentTurn);

    if (!nextTurnId) {
      // Not enough active players to continue, find the winner
      const getPlayerCardCount = (pId) => game.state.playerCards[pId]?.length || 0;
      const winner = game.state.players.find(p => getPlayerCardCount(p.id) < 6);
      if (winner) {
        io.to(gameCode).emit('gameEnded', { winner: { id: winner.id, name: winner.name } });
        delete games[gameCode];
      }
      return;
    }
    game.state.currentTurn = nextTurnId;

    // Check for full rotation to reveal next card (Turn/River)
    if (game.state.currentTurn === game.state.roundStarter) {
      const round = game.state.gameRound;
      if (round === 1 || round === 2) { // Reveal Turn or River
        const revealedCount = game.state.revealedCards.filter(Boolean).length;
        if (revealedCount < 5) {
          game.state.revealedCards[revealedCount] = true;
          game.state.gameRound++;
        }
      }
      // After reveal, set the next round's starting player
      game.state.roundStarter = game.state.currentTurn;
    }

    io.to(gameCode).emit('gameState', game.state);
  });

  // Call BS event
  socket.on('callBS', ({ gameCode }) => {
    const game = games[gameCode];
    if (!game || !game.state) return;
    game.state.phase = 'bs-reveal';

    // Reveal all player cards
    const revealedPlayerCards = game.state.playerCards;
    const communityCards = game.state.communityCards;
    const claimType = game.state.currentClaim;
    const claimerId = game.state.currentClaimerId;

    const revealedBoardCards = communityCards.filter((_, idx) => game.state.revealedCards[idx]);

    const allCards = [
      ...revealedBoardCards,
      ...Object.values(revealedPlayerCards).flat()
    ];

    const handExists = claimType ? isClaimValid(claimType, allCards) : false;
    const claimValid = !handExists; // true means BS call was correct

    const loserId = claimValid ? claimerId : socket.id;

    // Increment extra card penalty for loser and check elimination
    if (loserId) {
      const loserPlayer = game.players.find(p => p.id === loserId);
      if (loserPlayer) {
        loserPlayer.extraCards = (loserPlayer.extraCards || 0) + 1;
        // Eliminate if reached 6+ total cards (2 base + extra >=6)
        if ((loserPlayer.extraCards || 0) + 2 >= 6) {
          loserPlayer.isActive = false;
        }
      }
    }

    // Set new dealer to the loser (they start next round)
    if (loserId) {
      game.players = game.players.map(p => ({ ...p, isDealer: p.id === loserId }));
    }

    game.state.bsReveal = {
      revealedPlayerCards,
      communityCards: communityCards,
      revealedBoardFlags: game.state.revealedCards,
      claim: claimType,
      claimValid,
      loser: loserId,
      bestActualHand: getBestHand(allCards)
    };

    // Initialize continue acknowledgements
    game.state.continues = new Set();
    io.to(gameCode).emit('gameState', game.state);
  });

  // Handler for the flop animation
  socket.on('revealNextCard', ({ gameCode }) => {
    const game = games[gameCode];
    if (!game || !game.state) return;

    const revealedCount = game.state.revealedCards.filter(Boolean).length;
    if (revealedCount < 3) { // Only for the flop
      game.state.revealedCards[revealedCount] = true;
      if (revealedCount + 1 === 3) {
        game.state.gameRound = 1; // Flop complete
      }
      io.to(gameCode).emit('gameState', game.state);
    }
  });

  // Player presses Continue after BS reveal
  socket.on('bsContinue', ({ gameCode }) => {
    const game = games[gameCode];
    if (!game || !game.state || game.state.phase !== 'bs-reveal') return;

    // Ensure set exists
    if (!game.state.continues) {
      game.state.continues = new Set();
    }

    game.state.continues.add(socket.id);

    // Only consider players that are still active (not eliminated)
    const activePlayers = game.players.filter(p => p.isActive !== false);

    // Check if all ACTIVE players acknowledged
    if (game.state.continues.size >= activePlayers.length) {
      if (activePlayers.length <= 1) {
        // Build ranking list based on remaining card counts
        const getPlayerCardCount = (pId) => game.state.playerCards[pId]?.length || 0;
        const ranking = game.state.players.map(p => ({
          id: p.id,
          name: p.name,
          cardCount: getPlayerCardCount(p.id)
        })).sort((a,b)=>a.cardCount-b.cardCount);
        ranking.forEach((p,idx)=>{ p.placement = idx+1 });

        io.to(gameCode).emit('gameEnded', { players: ranking, gameCode });
        delete game.state;
        return;
      }

      delete game.state.continues;
      dealNewRound(game);
      io.to(gameCode).emit('gameState', game.state);
    }
  });
});

app.get('/', (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "1800");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  res.setHeader("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, PATCH, OPTIONS");
  res.send('Liar\'s Poker Socket.IO server running');
});

// Add a specific Socket.IO health check endpoint
app.get('/socket.io/', (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "1800");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  res.setHeader("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, PATCH, OPTIONS");
  res.json({ status: 'Socket.IO server is running' });
});

// tell Node to bind on **all** interfaces
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
}); 