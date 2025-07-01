const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
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
  if (lc.includes('pair of')) {
    const rank = rankFromWord(str.split('Pair of ')[1]);
    return { category: 'pair', rank };
  }
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
  if (lc.includes('full house')) {
    const match = str.match(/([0-9A-Za-z]+)s over ([0-9A-Za-z]+)s/i);
    if (match) {
      return { category: 'full_house', rank: rankFromWord(match[1]), pairRank: rankFromWord(match[2]) };
    }
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

function isClaimValid(claimStr, cards) {
  const parsed = parseClaimString(claimStr);
  if (!parsed) return false;

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
  game.players.forEach((p) => {
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
    if (!games[gameCode]) {
      callback({ error: 'Game not found' });
      return;
    }
    // Prevent duplicate players
    if (!games[gameCode].players.some(p => p.id === socket.id)) {
      games[gameCode].players.push({ id: socket.id, name: playerName, isHost: false, extraCards: 0, isDealer: false });
    }
    socket.join(gameCode);
    callback({ gameCode, players: games[gameCode].players });
    io.to(gameCode).emit('playerList', games[gameCode].players);
    // If the game has already started, send the current game state to the new player
    if (games[gameCode].state) {
      socket.emit('gameState', games[gameCode].state);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    for (const [code, game] of Object.entries(games)) {
      // Find if the disconnecting player is the host
      const wasHost = game.players.find((p) => p.id === socket.id && p.isHost);
      // Remove the player
      game.players = game.players.filter((p) => p.id !== socket.id);
      // If host left and there are still players, assign a new host
      if (wasHost && game.players.length > 0) {
        const newHostIndex = Math.floor(Math.random() * game.players.length);
        game.players = game.players.map((p, i) => ({ ...p, isHost: i === newHostIndex, isDealer: i === newHostIndex }));
      }
      io.to(code).emit('playerList', game.players);
      // Remove empty games
      if (game.players.length === 0) {
        delete games[code];
      }
    }
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

  // Make claim event
  socket.on('makeClaim', ({ gameCode, claim }) => {
    const game = games[gameCode];
    if (!game || !game.state) return;
    game.state.currentClaim = claim;
    game.state.currentClaimerId = socket.id;
    
    // Advance turn
    const idx = game.state.players.findIndex((p) => p.id === game.state.currentTurn);
    const nextIdx = (idx + 1) % game.state.players.length;
    game.state.currentTurn = game.state.players[nextIdx].id;

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

    // Check if all players acknowledged
    if (game.state.continues.size >= game.players.length) {
      const activePlayers = game.players.filter(p => p.isActive !== false);
      if (activePlayers.length <= 1) {
        // Declare winner and send players back to lobby
        io.to(gameCode).emit('gameEnded', { winner: activePlayers[0] });
        delete game.state;
        return;
      }

      delete game.state.continues;
      dealNewRound(game);
      io.to(gameCode).emit('gameState', game.state);
    }
  });
});

app.use(cors());
app.get('/', (req, res) => {
  res.send('Liar\'s Poker Socket.IO server running');
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
}); 