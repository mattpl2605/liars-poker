"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X, TrendingUp, TrendingDown } from "lucide-react"
import { ClaimString } from "./ui/claim-string"

const POKER_HANDS = ["High Card", "Pair", "Two Pair", "Three of a Kind", "Flush", "Straight", "Full House", "Four of a Kind", "Straight Flush", "Royal Flush"] as const
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const
const SUITS = ["Hearts", "Diamonds", "Clubs", "Spades"] as const

type PokerHand = typeof POKER_HANDS[number]
type Rank = typeof RANKS[number]
type Suit = typeof SUITS[number]

const getRankValue = (rank: string): number => {
  const rankMap: { [key: string]: number } = { "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14 }
  return rankMap[rank] || 0
}

const parseCurrentClaim = (claim: string | null) => {
    if (!claim) return { hand: "", rank: "", suit: "", secondRank: "" }
    if (claim.startsWith("Two Pair of")) {
      const match = claim.match(/Two Pair of ([0-9A-Za-z]+)s and ([0-9A-Za-z]+)s/i)
      if (match) {
        const r1 = match[1], r2 = match[2]
        const high = getRankValue(r1) >= getRankValue(r2) ? r1 : r2
        const low = high === r1 ? r2 : r1
        return { hand: "Two Pair", rank: high, suit: "", secondRank: low }
      }
    }
    if (claim.includes(" over ")) {
      const [tripRank, pairRank] = claim.split(" over ")
      return { hand: "Full House", rank: tripRank.replace("s", ""), suit: "", secondRank: pairRank.replace("s", "") }
    }
    if (claim.includes(" of ")) {
      const match = claim.match(/(.+) of ([0-9A-Za-z]+)s/i)
      if (match) return { hand: match[1].trim(), rank: match[2].toUpperCase(), suit: "", secondRank: "" }
    }
    let m = claim.match(/^([0-9A-Za-z]+)-high\s+(Hearts|Diamonds|Clubs|Spades)\s+Straight Flush$/i)
    if (m) return { hand: "Straight Flush", rank: m[1].toUpperCase(), suit: m[2], secondRank: "" }
    m = claim.match(/^([0-9A-Za-z]+)-high\s+Straight Flush$/i)
    if (m) return { hand: "Straight Flush", rank: m[1].toUpperCase(), suit: "", secondRank: "" }
    m = claim.match(/^([0-9A-Za-z]+)-high\s+(Hearts|Diamonds|Clubs|Spades)\s+Flush$/i)
    if (m) return { hand: "Flush", rank: m[1].toUpperCase(), suit: m[2], secondRank: "" }
    m = claim.match(/^([0-9A-Za-z]+)-high\s+(Straight|Flush)$/i)
    if (m) return { hand: m[2] === "Straight" ? "Straight" : "Flush", rank: m[1].toUpperCase(), suit: "", secondRank: "" }
    if (claim.includes("-high")) {
      const [rankPart, ...rest] = claim.split(" ")
      const rankClean = rankPart.replace("-high", "").toUpperCase()
      let hand = rest.join(" ").replace("-high", "").trim()
      // Normalize 'Card' to 'High Card' for proper hand ordering
      if (hand.toLowerCase() === "card") hand = "High Card"
      return { hand, rank: rankClean, suit: "", secondRank: "" }
    }
    return { hand: claim, rank: "", suit: "", secondRank: "" }
}
  
const compareFullHouses = (current: { rank: string; secondRank: string }, newClaim: { rank: string; secondRank: string }) => {
    const currentTripValue = getRankValue(current.rank), currentPairValue = getRankValue(current.secondRank)
    const newTripValue = getRankValue(newClaim.rank), newPairValue = getRankValue(newClaim.secondRank)
    if (newTripValue > currentTripValue) return true
    if (newTripValue < currentTripValue) return false
    return newPairValue > currentPairValue
}

interface HandSelectorProps {
  onCancel: () => void
  onSubmit: (claim: string) => void
  currentClaim: string | null
}

export function HandSelector({ onCancel, onSubmit, currentClaim }: HandSelectorProps) {
  const [selectedHandIndex, setSelectedHandIndex] = useState(0)
  const [selectedRankIndex, setSelectedRankIndex] = useState(0)
  const [selectedSecondRankIndex, setSelectedSecondRankIndex] = useState(0)
  const [selectedSuitIndex, setSelectedSuitIndex] = useState(0)

  const currentClaimParsed = parseCurrentClaim(currentClaim)
  const currentHandIndex = POKER_HANDS.indexOf(currentClaimParsed.hand as PokerHand)

  const availableHands = (() => {
    if (!currentClaim) return [...POKER_HANDS]
    const available = POKER_HANDS.slice(currentHandIndex)
    if (currentHandIndex > -1 && !available.includes(currentClaimParsed.hand as PokerHand)) {
      available.unshift(currentClaimParsed.hand as PokerHand)
    }
    return available
  })()
  
  const selectedHand = availableHands[selectedHandIndex]

  const availableRanks = (() => {
    // base list respecting overall minimums for certain hands
    const applyMinCap = (list: string[]) => {
      if (selectedHand === "Flush") {
        return list.filter(r => getRankValue(r) >= 7) // lowest flush is 7-high
      }
      if (selectedHand === "Straight" || selectedHand === "Straight Flush") {
        return list.filter(r => getRankValue(r) >= 5) // lowest straight is 5-high (wheel)
      }
      return list
    }

    if (selectedHand === "Straight Flush") {
      const baseListAll = RANKS.filter(r => r !== "A");
      if (!currentClaim || currentClaimParsed.hand !== selectedHand) {
        return applyMinCap([...baseListAll]);
      }
    }

    if (!selectedHand || !currentClaim || currentClaimParsed.hand !== selectedHand) {
      return applyMinCap([...RANKS])
    }

    if (selectedHand === "Two Pair") {
        if (!currentClaimParsed.rank || !currentClaimParsed.secondRank) return [...RANKS]
        return RANKS.filter(r => getRankValue(r) >= getRankValue(currentClaimParsed.rank))
    }

    if (selectedHand === "Flush") {
        if (!currentClaimParsed.rank) return applyMinCap([...RANKS])
        // For Flush a LOWER high card is considered stronger (unchanged)
        return applyMinCap(RANKS.filter(rank => getRankValue(rank) < getRankValue(currentClaimParsed.rank)))
    }
    if (selectedHand === "Straight") {
        if (!currentClaimParsed.rank) return applyMinCap([...RANKS])
        // Higher straight beats lower straight
        return applyMinCap(RANKS.filter(rank => getRankValue(rank) > getRankValue(currentClaimParsed.rank)))
    }
    if (selectedHand === "Straight Flush") {
        // Exclude Ace since Ace-high straight flush == Royal Flush
        const baseList = RANKS.filter(r => r !== "A")
        if (!currentClaimParsed.rank) return applyMinCap([...baseList])
        // Lower straight flush beats higher straight flush
        return applyMinCap(baseList.filter(rank => getRankValue(rank) < getRankValue(currentClaimParsed.rank)))
    }

    if (selectedHand === "Full House") {
        if (!currentClaimParsed.rank) return [...RANKS]
        return RANKS.filter(rank => getRankValue(rank) >= getRankValue(currentClaimParsed.rank))
    }

    if (!currentClaimParsed.rank) return [...RANKS]
    return RANKS.filter(rank => getRankValue(rank) > getRankValue(currentClaimParsed.rank))
  })()

  // For Straight Flush, completely remove Ace option (Ace-high is Royal Flush)
  const filteredAvailableRanks = selectedHand === "Straight Flush" ? availableRanks.filter(r => r !== "A") : availableRanks;

  const effectiveAvailableRanks = filteredAvailableRanks;

  const selectedRank = effectiveAvailableRanks[selectedRankIndex]

  const availableSecondRanks = (() => {
    if(!selectedHand) return []
    const baseRanks = RANKS.filter(r => r !== selectedRank)
    if (selectedHand === "Two Pair") {
        if (!currentClaim || currentClaimParsed.hand !== "Two Pair" || !currentClaimParsed.rank || !currentClaimParsed.secondRank) return baseRanks
        const { rank: currentRank, secondRank: currentSecondRank } = currentClaimParsed
        if (getRankValue(selectedRank) > getRankValue(currentRank)) return baseRanks
        if (getRankValue(selectedRank) === getRankValue(currentRank)) {
            return baseRanks.filter(r => getRankValue(r) > getRankValue(currentSecondRank))
        }
        return []
    }
    if (selectedHand === "Full House") {
        if (!currentClaim || currentClaimParsed.hand !== "Full House" || !currentClaimParsed.rank || !currentClaimParsed.secondRank) return baseRanks
        return baseRanks.filter(r => compareFullHouses({ rank: currentClaimParsed.rank, secondRank: currentClaimParsed.secondRank }, { rank: selectedRank, secondRank: r }))
    }
    return baseRanks
  })()

  const selectedSecondRank = availableSecondRanks[selectedSecondRankIndex]

  const selectedSuit = SUITS[selectedSuitIndex]

  useEffect(() => {
    if(availableHands[selectedHandIndex] !== selectedHand){
        setSelectedRankIndex(0)
        setSelectedSecondRankIndex(0)
        setSelectedSuitIndex(0)
    }
  }, [selectedHandIndex, availableHands, selectedHand])

  const needsRank = !!selectedHand && ["High Card", "Pair", "Two Pair", "Three of a Kind", "Straight", "Flush", "Straight Flush", "Full House", "Four of a Kind"].includes(selectedHand)
  const needsSecondRank = selectedHand === "Full House" || selectedHand === "Two Pair"
  const needsSuit = !!selectedHand && ["Flush", "Straight Flush", "Royal Flush"].includes(selectedHand)
  // Flush and Straight Flush are reverse-ranked (lower high card stronger). Straight is normal.
  const isReverseRanking = selectedHand === "Flush" || selectedHand === "Straight Flush"
  
  const handleSubmit = () => {
    if (!selectedHand) return
    let claimString: string = selectedHand
    if (needsRank && selectedRank) {
      if (selectedHand === "High Card") claimString = `${selectedRank}-high Card`
      else if (selectedHand === "Straight") claimString = `${selectedRank}-high Straight`
      else if (selectedHand === "Flush") claimString = `${selectedRank}-high ${selectedSuit} Flush`
      else if (selectedHand === "Full House" && selectedSecondRank) claimString = `${selectedRank}s over ${selectedSecondRank}s`
      else if (["Pair", "Three of a Kind", "Four of a Kind"].includes(selectedHand)) claimString = `${selectedHand} of ${selectedRank}s`
      else if (selectedHand === "Two Pair" && selectedSecondRank) {
        const highPair = getRankValue(selectedRank) >= getRankValue(selectedSecondRank) ? selectedRank : selectedSecondRank
        const lowPair = highPair === selectedRank ? selectedSecondRank : selectedRank
        claimString = `Two Pair of ${highPair}s and ${lowPair}s`
      }
    }
    if (selectedHand === "Royal Flush") {
        claimString = `Royal Flush of ${selectedSuit}`
    } else if (selectedHand === "Straight Flush" && selectedSuit && selectedRank) {
      claimString = `${selectedRank}-high ${selectedSuit} Straight Flush`
    }
    onSubmit(claimString)
  }

  const handleSetSelectedHand = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    if(index < availableHands.length) {
      setSelectedHandIndex(index);
    }
  }

  const handleSetSelectedRank = (e: React.ChangeEvent<HTMLInputElement>) => {
      const index = parseInt(e.target.value, 10);
      if(index < effectiveAvailableRanks.length) {
        setSelectedRankIndex(index);
      }
  }

  return (
    <div className="bg-black rounded-2xl p-2 space-y-1 w-full max-w-xs mx-auto max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 transform scale-90">
    <div className="slide-up-1 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Make Your Claim</h3>
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-gray-400 hover:text-white h-8 w-8 p-0">
        <X className="h-5 w-5" />
        </Button>
    </div>

    {currentClaim && (
        <div className="slide-up-1 text-center">
            <div className="text-xs text-gray-400">Beat</div>
            <div className="text-sm font-semibold text-yellow-400"><ClaimString text={currentClaim} /></div>
        </div>
    )}

    <div className="slide-up-2">
        <div className="flex items-center justify-between mb-2">
        <span className="text-white text-sm font-medium">Hand</span>
        <span className="text-blue-400 font-bold text-sm">{selectedHand}</span>
        </div>
        <input
        type="range"
        min="0"
        max={availableHands.length - 1}
        value={selectedHandIndex}
        onChange={handleSetSelectedHand}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider border border-gray-600"
        />
    </div>

    {/* Rank Selection for non-Full House */}
    {needsRank && selectedHand !== "Full House" && (
        <>
        <div className="slide-up-3">
            <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
                <span className="text-white text-sm font-medium">Strength</span>
                {isReverseRanking ? (
                <TrendingDown className="h-3 w-3 text-green-500" />
                ) : (
                <TrendingUp className="h-3 w-3 text-blue-500" />
                )}
            </div>
            <span className="text-xs text-gray-400">{isReverseRanking ? "Lower → Better" : "Higher → Better"}</span>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
            {(isReverseRanking ? [...RANKS].reverse() : RANKS).map((rank) => {
                const isAvailable = effectiveAvailableRanks.includes(rank)
                const isCurrent = currentClaimParsed.rank === rank && currentClaimParsed.hand === selectedHand
                const isSelected = selectedRank === rank

                return (
                <div
                    key={rank}
                    className={`p-1 rounded text-xs font-bold transition-all duration-200 text-center ${
                    isCurrent
                        ? "bg-yellow-500 text-white shadow-md"
                        : isSelected
                        ? "bg-blue-500 text-white shadow-md"
                        : isAvailable
                            ? "bg-green-600 text-white cursor-pointer hover:bg-green-500"
                            : "bg-gray-700 text-gray-500"
                    }`}
                    onClick={() => isAvailable && setSelectedRankIndex(effectiveAvailableRanks.indexOf(rank))}
                >
                    {rank}
                </div>
                )
            })}
            </div>

            <div className="flex items-center justify-between mb-1">
            <span className="text-white text-sm font-medium">
                {selectedHand === "Straight" || selectedHand === "Flush" ? "High Card" : "Rank"}
            </span>
            <span className="text-green-400 font-bold text-sm">{selectedRank}</span>
            </div>
        </div>
        </>
    )}

    {/* Full House Selection */}
    {selectedHand === "Full House" && (
    <div className="slide-up-3 space-y-2">
        {/* Trips */}
        <div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-white text-sm font-medium">Trips</span>
                <span className="text-green-400 font-bold text-sm">{selectedRank}</span>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
                {RANKS.map((rank) => {
                    const isAvailable = availableRanks.includes(rank);
                    const isSelected = selectedRank === rank;
                    const isPairRank = selectedSecondRank === rank;
                    return (
                        <div
                            key={`trip-${rank}`}
                            className={`p-1 rounded text-xs font-bold transition-all duration-200 text-center ${
                                isPairRank ? "bg-gray-800 text-gray-600 cursor-not-allowed" :
                                isSelected
                                    ? "bg-blue-500 text-white shadow-md"
                                    : isAvailable
                                    ? "bg-green-600 text-white cursor-pointer hover:bg-green-500"
                                    : "bg-gray-700 text-gray-500"
                                }`}
                            onClick={() => isAvailable && !isPairRank && setSelectedRankIndex(availableRanks.indexOf(rank))}
                        >
                            {rank}
                        </div>
                    );
                })}
            </div>
            {/* Trip rank slider removed per updated UX */}
        </div>

        {/* Pair */}
        <div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-white text-sm font-medium">Pair</span>
                <span className="text-purple-400 font-bold text-sm">{selectedSecondRank}</span>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
                {RANKS.map((rank) => {
                    const isAvailable = availableSecondRanks.includes(rank);
                    const isSelected = selectedSecondRank === rank;
                    const isTripRank = selectedRank === rank;
                    return (
                        <div
                            key={`pair-${rank}`}
                            className={`p-1 rounded text-xs font-bold transition-all duration-200 text-center ${
                                isTripRank ? "bg-gray-800 text-gray-600 cursor-not-allowed" :
                            isSelected
                                ? "bg-purple-500 text-white shadow-md"
                                : isAvailable
                                ? "bg-green-600 text-white cursor-pointer hover:bg-green-500"
                                : "bg-gray-700 text-gray-500"
                            }`}
                            onClick={() => isAvailable && !isTripRank && setSelectedSecondRankIndex(availableSecondRanks.indexOf(rank))}
                        >
                            {rank}
                        </div>
                    );
                })}
            </div>
            {/* Pair rank slider removed per updated UX */}
        </div>
    </div>
    )}

    {/* Two Pair second rank selection */}
    {selectedHand === "Two Pair" && (
      <div className="slide-up-3 space-y-2">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-sm font-medium">Second Pair</span>
            <span className="text-purple-400 font-bold text-sm">{selectedSecondRank}</span>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {RANKS.map((rank) => {
              const isAvailable = availableSecondRanks.includes(rank);
              const isSelected = selectedSecondRank === rank;
              const isFirstRank = selectedRank === rank;
              return (
                <div
                  key={`second-${rank}`}
                  className={`p-1 rounded text-xs font-bold transition-all duration-200 text-center ${
                    isFirstRank
                      ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                      : isSelected
                      ? "bg-purple-500 text-white shadow-md"
                      : isAvailable
                      ? "bg-green-600 text-white cursor-pointer hover:bg-green-500"
                      : "bg-gray-700 text-gray-500"
                  }`}
                  onClick={() => isAvailable && !isFirstRank && setSelectedSecondRankIndex(availableSecondRanks.indexOf(rank))}
                >
                  {rank}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )}

    {/* Suit Selection */}
    {needsSuit && (
        <div className="slide-up-4">
        <div className="flex items-center justify-between mb-1">
            <span className="text-white text-sm font-medium">Suit</span>
            <span className="text-red-400 font-bold text-sm">{selectedSuit}</span>
        </div>
        <input
            type="range"
            min="0"
            max={SUITS.length - 1}
            value={selectedSuitIndex}
            onChange={(e) => setSelectedSuitIndex(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider border border-gray-600"
        />
        </div>
    )}

    <div className="slide-up-5 pt-1">
        <Button
        onClick={handleSubmit}
        disabled={
            !selectedHand ||
            (needsRank && !selectedRank) ||
            (needsSecondRank && !selectedSecondRank) ||
            (needsSuit && !selectedSuit)
        }
        className="w-full h-10 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-base transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed rounded-full"
        >
            make claim
        </Button>
    </div>
    </div>
  )
} 