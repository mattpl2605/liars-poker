"use client"

import { useState, useEffect, useRef } from "react"

interface PlayingCardProps {
  suit: string
  rank: string
  isRevealed?: boolean
  highlighted?: boolean
}

export function PlayingCard({ suit, rank, isRevealed = true, highlighted = false }: PlayingCardProps) {
  const [isFlipped, setIsFlipped] = useState(isRevealed)
  const prevRevealed = useRef(isRevealed)

  // When card transitions from hidden -> revealed, set flipped after slight delay to kick CSS transition
  useEffect(() => {
    if (!prevRevealed.current && isRevealed) {
      const timeout = setTimeout(() => setIsFlipped(true), 20)
      return () => clearTimeout(timeout)
    }
    prevRevealed.current = isRevealed
  }, [isRevealed])

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

  const borderColor = highlighted ? "border-orange-400" : "border-gray-300"

  return (
    <div className="card-container w-10 h-16">
      <div className={`card-inner ${isFlipped ? "flipped" : ""}`}>
        {/* Card Back - shows when NOT flipped */}
        <div className={`card-front bg-red-600 flex items-center justify-center border-2 ${borderColor} shadow-lg`}>
          <div className="w-5 h-5 border-2 border-white rounded-full flex items-center justify-center">
            <div className="w-2 h-2 border border-white rounded-full" />
          </div>
        </div>

        {/* Card Front - shows when flipped */}
        <div className={`card-back bg-white flex flex-col items-center justify-center border-2 ${borderColor} shadow-lg`}>
          <div className={`text-lg font-bold ${getSuitColor(suit)} uppercase`}>{rank}</div>
          <div className={`text-lg ${getSuitColor(suit)}`}>{getSuitSymbol(suit)}</div>
        </div>
      </div>
    </div>
  )
}
