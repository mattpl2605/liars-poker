"use client"

import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Copy, Users, Play, ArrowLeft, Check } from "lucide-react"
import type { GameLobbyProps } from "@/types"

export function GameLobby({ gameCode, playerName, isHost, onStartGame, players, socket, onLeaveGame }: GameLobbyProps) {
  const [copyMessage, setCopyMessage] = useState("")

  const copyGameCode = () => {
    navigator.clipboard.writeText(gameCode)
    setCopyMessage("Copied!")
    setTimeout(() => setCopyMessage(""), 2000)
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:text-gray-300"
            onClick={onLeaveGame}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="text-center flex-1">
            <h1 className="text-4xl font-bold mb-2">game lobby</h1>
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl font-mono tracking-wider">{gameCode}</span>
              <Button variant="ghost" size="sm" onClick={copyGameCode} className="text-gray-400 hover:text-white">
                <Copy className="h-4 w-4" />
              </Button>
              {copyMessage && (
                <span className="flex items-center gap-1 text-green-400 text-sm">
                  <Check className="h-4 w-4" />
                  {copyMessage}
                </span>
              )}
            </div>
          </div>
          {/* Spacer to keep flex layout symmetrical */}
          <div className="w-8" />
        </div>

        {/* Players grid */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-6 justify-center">
            <Users className="h-5 w-5 text-gray-400" />
            <span className="text-gray-400">Players ({players.length})</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 justify-center">
            {players.map((player) => (
              <div key={player.id} className="text-center">
                <div className="relative mb-3">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-xl mx-auto">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  {player.isHost && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-600 rounded-full flex items-center justify-center text-xs font-bold">
                      H
                    </div>
                  )}
                </div>
                <div className="text-white font-medium">{player.name}</div>
                {player.isHost && <div className="text-yellow-400 text-xs mt-1">Host</div>}
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 5 - players.length) }).map((_, index) => (
              <div key={`empty-${index}`} className="text-center">
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center mx-auto mb-3">
                  <span className="text-gray-600 text-2xl">+</span>
                </div>
                <div className="text-gray-600 text-sm">waiting...</div>
              </div>
            ))}
          </div>
        </div>

        {/* Game rules */}
        <div className="mb-8">
          <h3 className="text-red-400 text-xl mb-4 text-center">game rules</h3>
          <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-800 max-w-2xl mx-auto">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-orange-400">•</span>
                <span className="text-gray-300">Each player gets 2 cards + community flop</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-400">•</span>
                <span className="text-gray-300">Claim poker hands higher than the previous player</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-400">•</span>
                <span className="text-gray-300">Call "BS" if you think someone is lying</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-blue-400">•</span>
                <span className="text-gray-300">Lose a BS call = get an extra card</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-purple-400">•</span>
                <span className="text-gray-300">5+ cards = you're out of the game!</span>
              </div>
            </div>
          </div>
        </div>

        {/* Start game / waiting indicator */}
        <div className="text-center">
          {isHost ? (
            players.length >= 2 ? (
              <Button
                onClick={onStartGame}
                className="px-12 py-4 text-lg font-semibold bg-green-600 hover:bg-green-700 rounded-full"
              >
                <Play className="h-5 w-5 mr-2" />
                Start Game
              </Button>
            ) : (
              <div className="text-gray-400 text-lg">Need at least 2 players to start</div>
            )
          ) : (
            <div className="text-gray-400 text-lg">Waiting for host to start the game...</div>
          )}
        </div>
      </div>
    </div>
  )
}
