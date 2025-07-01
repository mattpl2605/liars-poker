"use client"

import { useState, useEffect } from "react"

interface PlayingCardProps {
  suit: string
  rank: string
  isRevealed?: boolean
}

export function PlayingCard({ suit, rank, isRevealed = true }: PlayingCardProps) {
  const [shouldFlip, setShouldFlip] = useState(isRevealed)

  useEffect(() => {
    if (isRevealed !== shouldFlip) {
      // Small delay to make the flip more noticeable
      const timer = setTimeout(() => {
        setShouldFlip(isRevealed)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isRevealed, shouldFlip])

  const getSuitSymbol = (suit: string) => {
    switch (suit) {
      case "hearts":
        return "♥"
      case "diamonds":
        return "♦"
      case "clubs":
        return "♣"
      case "spades":
        return "♠"
      default:
        return ""
    }
  }

  const getSuitColor = (suit: string) => {
    return suit === "hearts" || suit === "diamonds" ? "text-red-500" : "text-black"
  }

  return (
    <div className="card-container w-16 h-24">
      <div className={`card-inner ${shouldFlip ? "flipped" : ""}`}>
        {/* Card Back - shows when NOT flipped */}
        <div className="card-front bg-red-600 flex items-center justify-center border-2 border-gray-300 shadow-lg">
          <div className="w-8 h-8 border-2 border-white rounded-full flex items-center justify-center">
            <div className="w-4 h-4 border border-white rounded-full" />
          </div>
        </div>

        {/* Card Front - shows when flipped */}
        <div className="card-back bg-white flex flex-col items-center justify-center border-2 border-gray-300 shadow-lg">
          <div className={`text-2xl font-bold ${getSuitColor(suit)}`}>{rank}</div>
          <div className={`text-2xl ${getSuitColor(suit)}`}>{getSuitSymbol(suit)}</div>
        </div>
      </div>
    </div>
  )
}
