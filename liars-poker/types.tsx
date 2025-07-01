export interface GameLobbyProps {
  gameCode: string
  playerName: string
  isHost: boolean
  onStartGame: () => void
  players: Player[]
  socket: any
  onLeaveGame?: () => void
}

export interface Player {
  id: string
  name: string
  isHost: boolean
}

export interface GameState {
  players: Player[]
  communityCards: { suit: string; rank: string }[]
  playerCards: { [playerId: string]: { suit: string; rank: string }[] }
  currentClaim: string | null
  currentTurn: string // player id
  phase: 'playing' | 'bs-reveal'
  revealedCards: boolean[]
  gameStarted: boolean
  gameRound: number
}
