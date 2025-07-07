"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import { PlayingCard } from "@/components/playing-card"
import { BSReveal } from "@/components/bs-reveal"
import { getSocket } from "@/lib/socket"
import type { GameState, Player } from "@/types"
import { HandSelector } from "./hand-selector"
import { GameEndScreen } from "./game-end-screen"
import { ClaimString } from "./ui/claim-string"

// Local extension to include placement for end-of-game rankings
interface RankedPlayer extends Player {
  placement: number
}

export interface GameInterfaceProps {
  socket: any
  playerName: string
  gameCode: string
  onLeaveGame?: () => void
  onReturnToLobby?: () => void
  gameState?: GameState | null
}

export function GameInterface({ socket, playerName, gameCode, onLeaveGame, onReturnToLobby, gameState: propGameState }: GameInterfaceProps) {
  const [gameState, setGameState] = useState<GameState | null>(propGameState || null)
  const [showHandSelector, setShowHandSelector] = useState(false)
  const [showBSReveal, setShowBSReveal] = useState(false)
  const [endPlayers, setEndPlayers] = useState<RankedPlayer[] | null>(null)

  useEffect(() => {
    if (propGameState) {
      setGameState(propGameState);
      setShowBSReveal(propGameState.phase === "bs-reveal");
    }
  
    if (!socket) return;
  
    const handleGameState = (state: GameState) => {
      setGameState(state);
      setShowBSReveal(state.phase === "bs-reveal");
    };
  
    const handleGameEnded = (data: { players: RankedPlayer[] }) => {
      setEndPlayers(data.players);
    };
  
    socket.on("gameState", handleGameState);
    socket.on("gameEnded", handleGameEnded);
  
    return () => {
      socket.off("gameState", handleGameState);
      socket.off("gameEnded", handleGameEnded);
    };
    // Re-run if the player list changes, to catch disconnects
  }, [socket, propGameState, propGameState?.players]);

  // Sequentially reveal the three flop cards with a single 400ms gap between them.
  useEffect(() => {
    if (!socket || !gameState || !gameState.gameStarted) return;

    // Only host triggers reveal
    const me = gameState.players.find((p: Player) => p.id === socket?.id) || gameState.players.find((p: Player) => p.name === playerName);
    if (!me?.isHost) return;

    const revealedCount = gameState.revealedCards.filter(Boolean).length;
    if (revealedCount >= 3) return; // flop already done

    const timer = setTimeout(() => {
      socket.emit("revealNextCard", { gameCode });
    }, 400);

    return () => clearTimeout(timer);
  }, [socket, gameState?.revealedCards, gameState?.gameStarted, gameCode, playerName]);

  const handleStartGame = () => {
    if (socket) socket.emit("startGame", { gameCode })
  }
  
  const handleBS = () => {
    if (socket) socket.emit("callBS", { gameCode })
  }
  
  const handleRaise = () => {
    setShowHandSelector(true)
  }
  
  const handleCancelClaim = () => {
    setShowHandSelector(false)
  }

  const handleClaimSubmit = (claim: string) => {
    if (socket) {
      socket.emit("makeClaim", { gameCode, claim })
      setShowHandSelector(false)
    }
  }

  const handleBSComplete = () => {
    if (socket) socket.emit("bsContinue", { gameCode })
  }
  
  const handleLeaveGame = () => onLeaveGame && onLeaveGame()
  const handleReturnToLobby = () => onReturnToLobby && onReturnToLobby()

  if(endPlayers){
    return <GameEndScreen players={endPlayers} gameCode={gameCode} onPlayAgain={()=>{socket?.emit('claimHost',{gameCode});handleReturnToLobby();}} onReturnToLobby={handleReturnToLobby} onReturnHome={handleLeaveGame} />
  }

  if (!gameState) {
    return <div className="text-white p-8">Loading game...</div>
  }

  const me = gameState.players.find((p: Player) => p.id === socket?.id) || gameState.players.find((p: Player) => p.name === playerName);
  const meCardCount = me ? gameState.playerCards[me.id]?.length ?? me.cardCount : 0;
  const meEliminated = !me || meCardCount >= 6 || me.isActive === false;
  const isMyTurn = gameState.currentTurn === me?.id;

  const activePlayers = gameState.players.filter((p: Player) => {
    const count = gameState.playerCards[p.id]?.length || p.cardCount || 0;
    return count < 6 && p.isActive !== false;
  });

  if (gameState?.phase === "bs-reveal" && gameState.bsReveal) {
    return (
      <BSReveal
        players={gameState.players as Player[]}
        communityCards={gameState.bsReveal.communityCards}
        currentClaim={gameState.bsReveal.claim}
        revealedPlayerCards={gameState.bsReveal.revealedPlayerCards}
        claimValid={gameState.bsReveal.claimValid}
        loser={gameState.bsReveal.loser}
        revealedBoardFlags={gameState.bsReveal.revealedBoardFlags}
        onComplete={handleBSComplete}
        canAck={!meEliminated && activePlayers.length > 1}
        autoCompleteAfterMS={activePlayers.length <= 1 ? 5000 : undefined}
      />
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className={`flex items-center justify-between mb-8`}>
          <Button variant="ghost" size="sm" className="text-white hover:text-gray-300" onClick={handleLeaveGame}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Badge variant="outline" className="text-white border-white">
            {gameCode}
          </Badge>
        </div>

        <div className={`flex justify-center gap-6 mb-10`}>
          {gameState.players.map((player: Player) => (
            <div key={player.id} className="text-center">
              <div className="relative mb-2 w-10 h-10 mx-auto">
                {(() => {
                  const cardCount = gameState.playerCards[player.id]?.length || player.cardCount || 0;
                  const eliminated = cardCount >= 6 || player.isActive === false;
                  const isCurrentTurn = player.id === gameState.currentTurn;
                  
                  let baseClass = "from-gray-600 to-gray-800";
                  if(isCurrentTurn && !eliminated) {
                    baseClass = "from-orange-400 to-orange-600 ring-2 ring-orange-300 shadow-lg shadow-orange-500/50";
                  }

                  const extraClass = eliminated ? "opacity-40 grayscale" : "";
                  
                  return (
                    <div
                      className={`w-10 h-10 rounded-full bg-gradient-to-br ${baseClass} ${extraClass} flex items-center justify-center text-white text-base font-bold transition-all duration-300`}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                  )
                })()}
                {player.isDealer && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold">
                    D
                  </div>
                )}
                {(() => {
                  const cardCount = gameState.playerCards[player.id]?.length || player.cardCount || 0;
                  const eliminated = cardCount >= 6 || player.isActive === false;
                  if (!eliminated && gameState.playerCards[player.id]) {
                    return (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-600 rounded-full flex items-center justify-center text-xs font-bold">
                        {gameState.playerCards[player.id]?.length}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="text-xs text-gray-400 mt-1">{player.name}</div>
            </div>
          ))}
        </div>

        <div className={`flex justify-center gap-3 mb-10`}>
          {gameState.communityCards.map((card, index) => (
            <PlayingCard key={index} suit={card.suit} rank={card.rank} isRevealed={gameState.revealedCards[index]} />
          ))}
        </div>

        {gameState.currentClaim && (
          <div className={`flex justify-center mb-8`}>
            <div className="bg-gray-800 rounded-lg p-3 min-w-[200px] text-center border-2 border-green-500">
              <div className="text-gray-400 text-xs mb-1">Current Claim</div>
              <div className="text-white text-lg font-bold">
                <ClaimString text={gameState.currentClaim} />
              </div>
            </div>
          </div>
        )}

        <div className={`flex justify-center gap-3 mb-8`}>
          {me && gameState.playerCards[me.id] && gameState.playerCards[me.id].map((card, idx) => (
            <PlayingCard key={idx} suit={card.suit} rank={card.rank} isRevealed={true} />
          ))}
        </div>

        <div className={`flex justify-center gap-4 mb-10`}>
          {showHandSelector ? (
            <HandSelector
              onCancel={handleCancelClaim}
              onSubmit={handleClaimSubmit}
              currentClaim={gameState.currentClaim}
            />
          ) : (
            <>
              {isMyTurn && gameState.phase === "playing" && !meEliminated && (
                gameState.currentClaim ? (
                  <>
                    <Button onClick={handleRaise} className="bg-blue-600 hover:bg-blue-700 rounded-full">raise</Button>
                    <Button onClick={handleBS} className="bg-red-600 hover:red-700 rounded-full">call bs</Button>
                  </>
                ) : (
                  <Button onClick={handleRaise} className="bg-blue-600 hover:bg-blue-700 rounded-full">call</Button>
                )
              )}
              {me?.isHost && !gameState.gameStarted && (
                <Button onClick={handleStartGame} className="bg-green-600 hover:bg-green-700 rounded-full">start game</Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}