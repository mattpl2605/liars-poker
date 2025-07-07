"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GameLobby } from "@/components/game-lobby"
import { GameInterface } from "@/components/game-interface"
import { getSocket } from "@/lib/socket"
import { GameState as RealGameState } from "@/types"

type GameState = "onboarding" | "lobby" | "playing"

export default function Home() {
  const [gameState, setGameState] = useState<GameState>("onboarding")
  const [playerName, setPlayerName] = useState("")
  const [gameCode, setGameCode] = useState("")
  const [isHost, setIsHost] = useState(false)
  const [socket, setSocket] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [error, setError] = useState("")
  const [liveGameState, setLiveGameState] = useState<RealGameState | null>(null)

  useEffect(() => {
    if (!socket && typeof window !== "undefined") {
      setSocket(getSocket())
    }
    if (socket) {
      socket.on("playerList", (players: any[]) => {
        setPlayers(players)
        const me = players.find((p) => p.name === playerName && p.id === socket.id)
        setIsHost(!!me?.isHost)
      })
      socket.on("gameState", (state: RealGameState) => {
        setGameState("playing")
        setLiveGameState(state)
      })
    }
    return () => {
      if (socket) {
        socket.off("playerList")
        socket.off("gameState")
      }
    }
  }, [socket, playerName])

  const createGame = () => {
    if (!playerName.trim() || !socket) return
    if (!socket.connected) {
      socket.connect()
    }
    socket.emit("createGame", { playerName }, (res: any) => {
      if (res.error) {
        setError(res.error)
        setTimeout(() => setError(""), 5000)
        return
      }
      setGameCode(res.gameCode)
      setIsHost(true)
      setPlayers(res.players)
      setGameState("lobby")
    })
  }

  const joinGame = () => {
    if (!playerName.trim() || !gameCode.trim() || !socket) return
    if (!socket.connected) {
      socket.connect()
    }
    socket.emit("joinGame", { gameCode, playerName }, (res: any) => {
      if (res.error) {
        setError(res.error)
        setTimeout(() => setError(""), 5000)
        return
      }
      setGameCode(res.gameCode)
      setIsHost(false)
      setPlayers(res.players)
      setGameState("lobby")
    })
  }

  const startGame = () => {
    if (socket) socket.emit("startGame", { gameCode })
  }

  const returnToLobby = () => {
    setLiveGameState(null);
    setGameState("lobby");
  }

  const leaveGame = () => {
    if(socket) socket.disconnect();
    setGameState("onboarding")
    setPlayerName("")
    setGameCode("")
    setIsHost(false)
  }

  if (gameState === "onboarding") {
    return (
      <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center justify-center">
        <div className="max-w-2xl w-full text-center space-y-8">
          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-6xl font-bold text-white mb-2">liar's poker</h1>
            <p className="text-gray-400 text-lg">bluff your way to victory with cards and cunning</p>
          </div>

          {/* Central decorative element - playing cards */}
          <div className="h-20 flex items-center justify-center mb-8">
            <div className="flex gap-1">
              {/* Ace of Spades */}
              <div className="w-12 h-16 bg-white rounded transform rotate-12 shadow-lg flex flex-col items-center justify-center border-2 border-gray-300">
                <div className="text-lg font-bold text-black uppercase">A</div>
                <div className="text-lg text-black">♠</div>
              </div>
              {/* Ace of Hearts */}
              <div className="w-12 h-16 bg-white rounded transform -rotate-12 shadow-lg flex flex-col items-center justify-center border-2 border-gray-300">
                <div className="text-lg font-bold text-red-500 uppercase">A</div>
                <div className="text-lg text-red-500">♥</div>
              </div>
            </div>
          </div>

          {/* Input fields side by side */}
          <div className="flex gap-6 justify-center max-w-lg mx-auto">
            <div className="flex-1">
              <Input
                placeholder="enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="bg-transparent border-b-2 border-gray-600 border-t-0 border-l-0 border-r-0 rounded-none text-center text-white placeholder-gray-500 text-lg py-3 focus:border-white"
              />
            </div>
            <div className="flex-1">
              <Input
                placeholder="enter 4-letter code"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                className="bg-transparent border-b-2 border-gray-600 border-t-0 border-l-0 border-r-0 rounded-none text-center text-white placeholder-gray-500 text-lg py-3 focus:border-white"
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

          {/* Action buttons */}
          <div className="flex gap-6 justify-center">
            <Button
              onClick={createGame}
              disabled={!playerName.trim()}
              className="px-8 py-4 text-lg font-semibold bg-blue-600 hover:bg-blue-700 rounded-full"
            >
              new game
            </Button>
            <Button
              onClick={joinGame}
              disabled={!playerName.trim() || !gameCode.trim()}
              className="px-8 py-4 text-lg font-semibold bg-purple-600 hover:bg-purple-700 rounded-full"
            >
              join game
            </Button>
          </div>

          {/* How to play */}
          <div className="mt-12">
            <h3 className="text-red-400 text-xl mb-4">how to play</h3>
            <div className="bg-gray-900/50 rounded-lg p-6 text-left space-y-3 border border-gray-800">
              <div className="flex items-start gap-3">
                <span className="text-orange-400 text-lg">🃏</span>
                <span className="text-gray-300">each player gets 2 cards plus community flop</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-400 text-lg">🎯</span>
                <span className="text-gray-300">claim poker hands higher than the last player using the board and player cards</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-400 text-lg">🔄</span>
                <span className="text-gray-300">call BS if you think someone is lying about their hand</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === "lobby") {
    return (
      <GameLobby
        gameCode={gameCode}
        playerName={playerName}
        isHost={isHost}
        onStartGame={startGame}
        players={players}
        socket={socket}
        onLeaveGame={leaveGame}
      />
    )
  }

  if (gameState === "playing") {
    return <GameInterface socket={socket} playerName={playerName} gameCode={gameCode} onLeaveGame={leaveGame} onReturnToLobby={returnToLobby} gameState={liveGameState} />
  }

  return <GameInterface socket={socket} playerName={playerName} gameCode={gameCode} onLeaveGame={leaveGame} onReturnToLobby={returnToLobby} />
}
