"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlayingCard } from "@/components/playing-card"
import { CheckCircle, XCircle } from "lucide-react"

interface Player {
  id: string
  name: string
  score: number
  cardCount: number
  cards: Array<{ suit: string; rank: string }>
  isActive: boolean
  isDealer: boolean
}

interface BSRevealProps {
  players: Player[]
  communityCards: Array<{ suit: string; rank: string }>
  revealedBoardFlags: boolean[]
  currentClaim: string
  revealedPlayerCards: Record<string, Array<{ suit: string; rank: string }>>
  claimValid: boolean
  loser: string
  onComplete: () => void
}

export function BSReveal({ players, communityCards, revealedBoardFlags, currentClaim, revealedPlayerCards, claimValid, loser, onComplete }: BSRevealProps) {
  const [showResult, setShowResult] = useState(false)
  const [revealedMap, setRevealedMap] = useState<Record<string, boolean>>({})
  const [readyClicked, setReadyClicked] = useState(false)

  // Animate player card reveals
  useEffect(() => {
    const timers: NodeJS.Timeout[] = []
    let delay = 300
    Object.entries(revealedPlayerCards).forEach(([pid, cards]) => {
      cards.forEach((_, idx) => {
        timers.push(
          setTimeout(() => {
            setRevealedMap((prev) => ({ ...prev, [`${pid}-${idx}`]: true }))
          }, delay),
        )
        delay += 200
      })
    })
    const resTimer = setTimeout(() => setShowResult(true), delay + 500)
    timers.push(resTimer)
    return () => timers.forEach(clearTimeout)
  }, [revealedPlayerCards])

  const handleContinue = () => {
    if (readyClicked) return
    setReadyClicked(true)
    onComplete()
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-6xl mx-auto">
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">BS Called!</CardTitle>
            <p className="text-gray-400">Revealing all cards...</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Community Cards */}
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-4 text-white">Community Cards</h3>
              <div className="flex justify-center gap-2">
                {communityCards.map((card, index) => (
                  <PlayingCard
                    key={index}
                    suit={card.suit}
                    rank={card.rank}
                    isRevealed={revealedBoardFlags[index]}
                  />
                ))}
              </div>
            </div>

            {/* Player Cards */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-center text-white">Player Cards</h3>
              {players.map((player) => (
                <div key={player.id} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-white">{player.name}</span>
                    <span className="text-gray-400">{player.cardCount}</span>
                  </div>
                  <div className="flex gap-2">
                    {revealedPlayerCards[player.id]
                      ? revealedPlayerCards[player.id].map((card, index) => (
                          <PlayingCard
                            key={index}
                            suit={card.suit}
                            rank={card.rank}
                            isRevealed={!!revealedMap[`${player.id}-${index}`]}
                          />
                        ))
                      : Array.from({ length: player.cardCount }).map((_, index) => (
                          <PlayingCard key={index} suit="" rank="" isRevealed={false} />
                        ))}
                  </div>
                </div>
              ))}
            </div>

            {/* BS Result */}
            {showResult && (
              <div className="text-center space-y-4">
                <div
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                    claimValid ? "bg-green-600" : "bg-red-600"
                  }`}
                >
                  {claimValid ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                  <span className="font-semibold">{claimValid ? "BS Valid!" : "BS Invalid!"}</span>
                </div>

                <div className="text-gray-300">
                  Claimed: <strong>{currentClaim}</strong>
                </div>

                <div className="text-gray-300">
                  {claimValid
                    ? `The claimed ${currentClaim} does not exist. The claimer gets an extra card.`
                    : `The claimed ${currentClaim} exists. The BS caller gets an extra card.`}
                </div>

                <Button
                  onClick={handleContinue}
                  size="lg"
                  className={`mt-4 ${readyClicked ? "bg-gray-600" : "bg-green-600 hover:bg-green-700"}`}
                  disabled={readyClicked}
                >
                  Ready
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
