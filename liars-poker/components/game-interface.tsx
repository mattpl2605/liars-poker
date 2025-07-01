"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import { PlayingCard } from "@/components/playing-card"
import { HandSelector } from "@/components/hand-selector"
import { BSReveal } from "@/components/bs-reveal"
import { getSocket } from "@/lib/socket"
import { GameState } from "@/types"

interface Player {
  id: string
  name: string
  score: number
  cardCount: number
  cards: Array<{ suit: string; rank: string }>
  isActive: boolean
  isDealer: boolean
}

interface GameInterfaceProps {
  playerName: string
  gameCode: string
  onLeaveGame?: () => void
  gameState?: GameState | null
}

const POKER_HANDS = [
  "High Card",
  "Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
  "Royal Flush",
]

export function GameInterface({ playerName, gameCode, onLeaveGame, gameState: propGameState }: GameInterfaceProps) {
  const [socket, setSocket] = useState<any>(null)
  const [gameState, setGameState] = useState<GameState | null>(propGameState || null)
  const [showHandSelector, setShowHandSelector] = useState(false)
  const [showBSReveal, setShowBSReveal] = useState(false)

  useEffect(() => {
    // Always make sure we have a socket connection
    if (!socket && typeof window !== "undefined") {
      setSocket(getSocket())
    }

    if (propGameState) {
      setGameState(propGameState)
      return
    }

    if (socket) {
      socket.on("gameState", (state: GameState) => {
        setGameState(state)
        if (state.phase === "bs-reveal") setShowBSReveal(true)
        else setShowBSReveal(false)
      })

      // Listen for game end (only one active player left)
      socket.on("gameEnded", (data: { winner: { id: string; name: string } }) => {
        if (typeof window !== "undefined") {
          alert(`${data.winner.name} wins the game!`)
        }
        onLeaveGame && onLeaveGame()
      })
    }
    return () => {
      if (socket) socket.off("gameState")
      if (socket) socket.off("gameEnded")
    }
  }, [socket, gameCode, playerName, propGameState])

  // Flop reveal animation (host only, server-driven)
  useEffect(() => {
    if (
      socket &&
      gameState &&
      gameState.gameStarted &&
      gameState.gameRound === 0 &&
      gameState.revealedCards.filter(Boolean).length === 0
    ) {
      const me = gameState.players.find((p) => p.name === playerName && p.id === socket.id);
      if (me?.isHost) {
        setTimeout(() => socket.emit("revealNextCard", { gameCode }), 300);
        setTimeout(() => socket.emit("revealNextCard", { gameCode }), 900);
        setTimeout(() => socket.emit("revealNextCard", { gameCode }), 1500);
      }
    }
    // eslint-disable-next-line
  }, [gameState?.gameStarted, gameState?.gameRound, gameState?.revealedCards, socket]);

  // Action handlers
  const handleStartGame = () => {
    if (socket) socket.emit("startGame", { gameCode })
  }
  const handleClaimSubmit = (hand: string) => {
    if (socket && gameState) {
      socket.emit("makeClaim", { gameCode, claim: hand })
      setShowHandSelector(false)
    }
  }
  const handleBS = () => {
    if (socket) socket.emit("callBS", { gameCode })
  }
  const handleRevealNextCard = () => {
    if (socket) socket.emit("revealNextCard", { gameCode })
  }
  const handleRaise = () => setShowHandSelector(true)
  const handleBSComplete = () => {
    if (socket) socket.emit("bsContinue", { gameCode })
  }
  const handleLeaveGame = () => onLeaveGame && onLeaveGame()

  if (!gameState) {
    return <div className="text-white p-8">Loading game...</div>
  }

  const me = gameState.players.find((p) => p.name === playerName)
  const isMyTurn = gameState.currentTurn === me?.id

  if (gameState?.phase === "bs-reveal" && gameState.bsReveal) {
    return (
      <BSReveal
        players={gameState.players}
        communityCards={gameState.bsReveal.communityCards}
        currentClaim={gameState.bsReveal.claim}
        revealedPlayerCards={gameState.bsReveal.revealedPlayerCards}
        claimValid={gameState.bsReveal.claimValid}
        loser={gameState.bsReveal.loser}
        revealedBoardFlags={gameState.bsReveal.revealedBoardFlags}
        onComplete={handleBSComplete}
      />
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" className="text-white hover:text-gray-300" onClick={handleLeaveGame}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Badge variant="outline" className="text-white border-white">
            {gameCode}
          </Badge>
        </div>

        {/* Players */}
        <div className="flex justify-center gap-4 mb-8">
          {gameState.players.map((player) => (
            <div key={player.id} className="text-center">
              <div className="relative">
                {(() => {
                  const cardCount = gameState.playerCards[player.id]?.length || player.cardCount || 0
                  const eliminated = cardCount >= 6
                  const baseClass = player.id === gameState.currentTurn && !eliminated
                    ? "from-orange-400 to-orange-600 ring-2 ring-orange-300 shadow-lg shadow-orange-500/50"
                    : "from-gray-600 to-gray-800"
                  const extraClass = eliminated ? "opacity-40 grayscale" : ""
                  return (
                    <div
                      className={`w-12 h-12 rounded-full bg-gradient-to-br ${baseClass} ${extraClass} flex items-center justify-center text-white font-bold mb-2 transition-all duration-300`}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                  )
                })()}
                {player.isDealer && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold">
                    D
                  </div>
                )}
                {gameState.playerCards[player.id] && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-yellow-600 rounded-full flex items-center justify-center text-xs font-bold">
                    {gameState.playerCards[player.id]?.length}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-400">{player.name}</div>
            </div>
          ))}
        </div>

        {/* Community Cards */}
        <div className="flex justify-center gap-2 mb-8">
          {gameState.communityCards.map((card, index) => (
            <PlayingCard key={index} suit={card.suit} rank={card.rank} isRevealed={gameState.revealedCards[index]} />
          ))}
        </div>

        {/* Current Claim */}
        {gameState.currentClaim && (
          <div className="flex justify-center mb-8">
            <div className="bg-gray-800 rounded-lg p-4 min-w-[200px] text-center border-2 border-green-500">
              <div className="text-gray-400 text-sm mb-1">Current Claim</div>
              <div className="text-white text-lg font-bold">{gameState.currentClaim}</div>
            </div>
          </div>
        )}

        {/* Player's own cards */}
        <div className="flex justify-center gap-2 mb-8">
          {gameState.playerCards[me?.id || ""]?.map((card, idx) => (
            <PlayingCard key={idx} suit={card.suit} rank={card.rank} isRevealed={true} />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-4 mb-8">
          {isMyTurn && gameState.phase === "playing" && (
            gameState.currentClaim ? (
              <>
                <Button onClick={handleRaise} className="bg-blue-600 hover:bg-blue-700">Raise</Button>
                <Button onClick={handleBS} className="bg-red-600 hover:bg-red-700">Call BS</Button>
              </>
            ) : (
              <Button onClick={handleRaise} className="bg-blue-600 hover:bg-blue-700">Call</Button>
            )
          )}
          {me?.isHost && !gameState.gameStarted && (
            <Button onClick={handleStartGame} className="bg-green-600 hover:bg-green-700">Start Game</Button>
          )}
        </div>

        {/* Hand Selector */}
        {showHandSelector && (
          <HandSelector currentClaim={gameState.currentClaim} onSubmit={handleClaimSubmit} onCancel={() => setShowHandSelector(false)} />
        )}
      </div>
    </div>
  )
}
