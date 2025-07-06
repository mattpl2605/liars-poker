/* Game end screen UI per provided mockup */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Trophy, Crown, Medal, RotateCcw, Home, Users } from "lucide-react"
import type { Player as BasePlayer } from "@/types"

type RankedPlayer = BasePlayer & { placement: number }

interface GameEndScreenProps {
  players: RankedPlayer[]
  gameCode: string
  onPlayAgain: () => void
  onReturnToLobby: () => void
  onReturnHome: () => void
}

export function GameEndScreen({ players, gameCode, onPlayAgain, onReturnToLobby, onReturnHome }: GameEndScreenProps) {
  const [showStats, setShowStats] = useState(false)
  const sortedPlayers = [...players].sort((a,b)=>a.placement-b.placement)
  const winner = sortedPlayers[0]

  const getPlacementIcon = (placement:number)=>{
    switch(placement){
      case 1: return <Crown className="h-5 w-5 text-yellow-400" />
      case 2: return <Medal className="h-5 w-5 text-gray-300" />
      case 3: return <Medal className="h-5 w-5 text-amber-600" />
      default:
        return <div className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center text-xs font-bold text-white">{placement}</div>
    }
  }

  const getPlacementColor = (placement:number)=>{
    switch(placement){
      case 1: return "from-yellow-400 to-yellow-600"
      case 2: return "from-gray-300 to-gray-500"
      case 3: return "from-amber-500 to-amber-700"
      default: return "from-gray-600 to-gray-800"
    }
  }

  const getPlacementText=(placement:number)=>{
    switch(placement){
      case 1: return "Winner!"
      case 2: return "2nd Place"
      case 3: return "3rd Place"
      default: return `${placement}th Place`
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col">
      <div className="max-w-md mx-auto flex-1 flex flex-col w-full">
        {/* Header */}
        <div className="text-center mb-6 slide-up-1">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/25">
            <Trophy className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Game Over!</h1>
          <div className="text-sm text-gray-400">Room: {gameCode}</div>
        </div>

        {/* Winner */}
        <div className="text-center mb-6 slide-up-2">
          <div className="bg-gradient-to-r from-yellow-600/20 to-yellow-500/20 border border-yellow-500/50 rounded-xl p-4">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {winner.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-lg font-bold text-yellow-300">{winner.name}</div>
                <div className="text-sm text-yellow-400">Champion</div>
              </div>
              <Crown className="h-6 w-6 text-yellow-400" />
            </div>
            <div className="text-xs text-yellow-200">Survived with {winner.cardCount} cards</div>
          </div>
        </div>

        {/* Rankings */}
        <div className="flex-1 mb-6 slide-up-3">
          <div className="text-sm font-medium text-gray-400 text-center mb-3">Final Rankings</div>
          <div className="space-y-2">
            {sortedPlayers.map(player=> (
              <div key={player.id} className={`flex items-center gap-3 rounded-lg p-3 transition-all duration-200 ${player.placement===1?"bg-yellow-600/10 border border-yellow-500/30":"bg-gray-800/50"}`}>
                <div className="flex-shrink-0">{getPlacementIcon(player.placement)}</div>
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getPlacementColor(player.placement)} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{player.name}</div>
                  <div className="text-xs text-gray-400">{getPlacementText(player.placement)}</div>
                </div>
                <div className="flex-shrink-0">
                  <div className={`px-2 py-1 rounded text-xs font-bold ${player.cardCount!<=2?"bg-green-600/80 text-green-100":player.cardCount!<=4?"bg-yellow-600/80 text-yellow-100":"bg-red-600/80 text-red-100"}`}>{player.cardCount!} cards</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-3 slide-up-4">
          <Button onClick={onPlayAgain} className="w-full h-12 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-base transition-all duration-200 hover:shadow-lg hover:shadow-green-500/25">
            <RotateCcw className="h-4 w-4 mr-2" />
            Play Again
          </Button>
            <Button onClick={onReturnHome} className="w-full h-12 rounded-xl bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold text-base transition-all duration-200 hover:shadow-lg hover:shadow-gray-500/25">
              <Home className="h-4 w-4 mr-2" />Home
            </Button>
        </div>
      </div>
    </div>
  )
} 