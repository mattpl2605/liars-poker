"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, TrendingUp, TrendingDown } from "lucide-react"

interface HandSelectorProps {
  currentClaim: string | null
  onSubmit: (hand: string, rank?: string, suit?: string) => void
  onCancel: () => void
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

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
const SUITS = ["Hearts", "Diamonds", "Clubs", "Spades"]

// Helper function to get rank value for comparison
const getRankValue = (rank: string): number => {
  const rankMap: { [key: string]: number } = {
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14,
  }
  return rankMap[rank] || 0
}

// Helper function to parse current claim
const parseCurrentClaim = (claim: string | null) => {
  if (!claim) return { hand: "", rank: "", suit: "", secondRank: "" }

  // Handle Two Pair: "Two Pair of 10s and 4s" (must come before generic 'of' handler)
  if (claim.startsWith("Two Pair of")) {
    const match = claim.match(/Two Pair of ([0-9A-Za-z]+)s and ([0-9A-Za-z]+)s/i)
    if (match) {
      const r1 = match[1]
      const r2 = match[2]
      const high = getRankValue(r1) >= getRankValue(r2) ? r1 : r2
      const low = high === r1 ? r2 : r1
      return { hand: "Two Pair", rank: high, suit: "", secondRank: low }
    }
  }

  // Handle Full House before generic 'of'
  if (claim.includes(" over ")) {
    const [tripRank, pairRank] = claim.split(" over ")
    return {
      hand: "Full House",
      rank: tripRank.replace("s", ""),
      suit: "",
      secondRank: pairRank.replace("s", ""),
    }
  }
  
  // Generic 'of' handler
  if (claim.includes(" of ")) {
    const match = claim.match(/(.+) of ([0-9A-Za-z]+)s/i)
    if (match) {
      return { hand: match[1].trim(), rank: match[2].toUpperCase(), suit: "", secondRank: "" }
    }
  }
  
  // Handle Straight Flush with suit e.g. "K-high Spades Straight Flush"
  let m = claim.match(/^([0-9A-Za-z]+)-high\s+(Hearts|Diamonds|Clubs|Spades)\s+Straight Flush$/i)
  if (m) {
    return { hand: "Straight Flush", rank: m[1].toUpperCase(), suit: m[2], secondRank: "" }
  }

  // Handle Straight Flush without suit e.g. "K-high Straight Flush"
  m = claim.match(/^([0-9A-Za-z]+)-high\s+Straight Flush$/i)
  if (m) {
    return { hand: "Straight Flush", rank: m[1].toUpperCase(), suit: "", secondRank: "" }
  }

  // Handle Flush with suit e.g. "K-high Spades Flush"
  m = claim.match(/^([0-9A-Za-z]+)-high\s+(Hearts|Diamonds|Clubs|Spades)\s+Flush$/i)
  if (m) {
    return { hand: "Flush", rank: m[1].toUpperCase(), suit: m[2], secondRank: "" }
  }

  // Handle generic Flush/Straight e.g. "K-high Flush" or "10-high Straight"
  m = claim.match(/^([0-9A-Za-z]+)-high\s+(Straight|Flush)$/i)
  if (m) {
    return { hand: m[2] === "Straight" ? "Straight" : "Flush", rank: m[1].toUpperCase(), suit: "", secondRank: "" }
  }

  // Fallback generic '-high' handler (kept for safety)
  if (claim.includes("-high")) {
    const [rankPart, ...rest] = claim.split(" ")
    const rankClean = rankPart.replace("-high", "").toUpperCase()
    const hand = rest.join(" ").replace("-high", "").trim()
    return { hand, rank: rankClean, suit: "", secondRank: "" }
  }

  // Fallback for simple hands like "Royal Flush"
  return { hand: claim, rank: "", suit: "", secondRank: "" }
}

// Helper function to compare full houses
const compareFullHouses = (
  current: { rank: string; secondRank: string },
  newClaim: { rank: string; secondRank: string },
) => {
  const currentTripValue = getRankValue(current.rank)
  const currentPairValue = getRankValue(current.secondRank)
  const newTripValue = getRankValue(newClaim.rank)
  const newPairValue = getRankValue(newClaim.secondRank)

  // First compare the trips (three of a kind)
  if (newTripValue > currentTripValue) return true
  if (newTripValue < currentTripValue) return false

  // If trips are equal, compare the pairs
  return newPairValue > currentPairValue
}

export function HandSelector({ currentClaim, onSubmit, onCancel }: HandSelectorProps) {
  const [selectedHand, setSelectedHand] = useState("")
  const [selectedRank, setSelectedRank] = useState("")
  const [selectedSecondRank, setSelectedSecondRank] = useState("")
  const [selectedSuit, setSelectedSuit] = useState("")

  const currentClaimParsed = parseCurrentClaim(currentClaim)
  const currentHandIndex = POKER_HANDS.indexOf(currentClaimParsed.hand)

  const needsRank =
    selectedHand &&
    [
      "High Card",
      "Pair",
      "Two Pair",
      "Three of a Kind",
      "Straight",
      "Flush",
      "Straight Flush",
      "Full House",
      "Four of a Kind",
    ].includes(selectedHand)

  const needsSecondRank = selectedHand === "Full House" || selectedHand === "Two Pair"
  const needsSuit = selectedHand && ["Flush", "Straight Flush"].includes(selectedHand)

  // Get available hands based on current claim
  const getAvailableHands = () => {
    if (!currentClaim) return POKER_HANDS

    // Current claimed hand plus all higher-ranking categories
    return [currentClaimParsed.hand, ...POKER_HANDS.slice(currentHandIndex + 1)]
  }

  // Get available ranks based on current claim and selected hand
  const getAvailableRanks = () => {
    if (!currentClaim || !selectedHand) return RANKS
    if (currentClaimParsed.hand !== selectedHand) return RANKS

    // Special comparison for Two Pair
    if (selectedHand === "Two Pair") {
      if (!currentClaimParsed.rank || !currentClaimParsed.secondRank) return RANKS;
      const maxCurrent = getRankValue(currentClaimParsed.rank)
      return RANKS.filter(r => getRankValue(r) >= maxCurrent)
    }

    const currentRankValue = getRankValue(currentClaimParsed.rank)

    // For straight / flush variants, lower high-card is better (fewer cards used)
    if (selectedHand === "Straight" || selectedHand === "Flush" || selectedHand === "Straight Flush") {
      return RANKS.filter((rank) => getRankValue(rank) < currentRankValue)
    }

    // For Full House, trips must be >= current trips rank
    if (selectedHand === "Full House") {
      if (!currentClaim || currentClaimParsed.hand !== "Full House" || !currentClaimParsed.rank) {
        return RANKS
      }
      const currentTripVal = getRankValue(currentClaimParsed.rank)
      return RANKS.filter((rank) => getRankValue(rank) >= currentTripVal)
    }

    // For other hands, higher is better
    return RANKS.filter((rank) => getRankValue(rank) > currentRankValue)
  }

  // Get available second ranks for Full House
  const getAvailableSecondRanks = () => {
    if (selectedHand === "Two Pair") {
      if (!selectedRank) return []
      if (!currentClaim || currentClaimParsed.hand !== "Two Pair" || !currentClaimParsed.rank || !currentClaimParsed.secondRank) {
        return RANKS.filter((r) => r !== selectedRank)
      }
      
      const maxCurrent = getRankValue(currentClaimParsed.rank)
      const minCurrent = getRankValue(currentClaimParsed.secondRank)
      const selectedFirstRankVal = getRankValue(selectedRank)

      // If selected first pair is higher than current high pair, any second pair is valid.
      if (selectedFirstRankVal > maxCurrent) {
        return RANKS.filter(r => r !== selectedRank)
      }

      // If selected first pair is equal to current high pair, second pair must be higher.
      if (selectedFirstRankVal === maxCurrent) {
        return RANKS.filter(r => r !== selectedRank && getRankValue(r) > minCurrent)
      }
      
      // If selected first pair is lower, no valid second pair exists.
      return []
    }
    if (selectedHand !== "Full House" || !selectedRank) return RANKS.filter((r) => r !== selectedRank)

    if (!currentClaim || currentClaimParsed.hand !== "Full House") {
      return RANKS.filter((r) => r !== selectedRank)
    }

    // Filter based on what would make a better full house
    return RANKS.filter((rank) => {
      if (rank === selectedRank) return false // Can't have same rank for trips and pair

      const wouldBeBetter = compareFullHouses(
        { rank: currentClaimParsed.rank, secondRank: currentClaimParsed.secondRank },
        { rank: selectedRank, secondRank: rank },
      )

      return wouldBeBetter
    })
  }

  const handleSubmit = () => {
    if (!selectedHand) return

    let claimString = selectedHand

    if (needsRank && selectedRank) {
      if (selectedHand === "High Card") {
        claimString = `${selectedRank}-high Card`
      } else if (selectedHand === "Straight") {
        claimString = `${selectedRank}-high Straight`
      } else if (selectedHand === "Flush") {
        claimString = `${selectedRank}-high ${selectedSuit} Flush`
      } else if (selectedHand === "Full House" && selectedSecondRank) {
        claimString = `${selectedRank}s over ${selectedSecondRank}s`
      } else if (["Pair", "Three of a Kind", "Four of a Kind"].includes(selectedHand)) {
        claimString = `${selectedHand} of ${selectedRank}s`
      } else if (selectedHand === "Two Pair" && selectedSecondRank) {
        const highPair = getRankValue(selectedRank) >= getRankValue(selectedSecondRank) ? selectedRank : selectedSecondRank
        const lowPair = highPair === selectedRank ? selectedSecondRank : selectedRank
        claimString = `${selectedHand} of ${highPair}s and ${lowPair}s`
      }
    } else if (selectedHand === "Straight Flush") {
      if(selectedSuit){
        claimString = `${selectedRank}-high ${selectedSuit} Straight Flush`
      }
    }

    onSubmit(claimString, selectedRank, needsSuit ? selectedSuit : undefined)
  }

  const selectableHands = getAvailableHands()
  const availableRanks = getAvailableRanks()
  const availableSecondRanks = getAvailableSecondRanks()

  // Check if we're dealing with reverse ranking
  const isReverseRanking = selectedHand === "Straight" || selectedHand === "Flush" || selectedHand === "Straight Flush"

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Select Your Claim</CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Poker Hand</label>
            <Select value={selectedHand} onValueChange={setSelectedHand}>
              <SelectTrigger>
                <SelectValue
                  placeholder={currentClaim ? "Choose a hand higher than current claim" : "Choose a poker hand"}
                />
              </SelectTrigger>
              <SelectContent>
                {POKER_HANDS.map((hand) => (
                  <SelectItem key={hand} value={hand} disabled={!selectableHands.includes(hand)}>
                    {hand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsRank && selectedHand !== "Full House" && selectedHand !== "Two Pair" && (
            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                {selectedHand === "Straight" || selectedHand === "Flush"
                  ? "High Card (lower is better)"
                  : selectedHand === "High Card"
                    ? "High Card"
                    : "Rank"}
                {isReverseRanking ? (
                  <TrendingDown className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                )}
              </label>

              {/* Visual Rank Hierarchy */}
              <div className="mb-3 p-3 bg-gray-50 rounded-lg border">
                <div className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                  {isReverseRanking ? (
                    <>
                      <TrendingDown className="h-3 w-3 text-green-500" />
                      Strength (Lower = Better)
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-3 w-3 text-blue-500" />
                      Strength (Higher = Better)
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(isReverseRanking ? [...RANKS].reverse() : RANKS).map((rank) => {
                    let isAvailable = availableRanks.includes(rank)
                    if (selectedHand === "Full House" && currentClaimParsed.hand === "Full House" && currentClaimParsed.rank) {
                      const tripVal = getRankValue(rank)
                      const currentTripVal = getRankValue(currentClaimParsed.rank)
                      const currentPairVal = getRankValue(currentClaimParsed.secondRank)

                      if (tripVal > currentTripVal) {
                        isAvailable = true
                      } else if (tripVal === currentTripVal) {
                        // Need at least one higher possible pair
                        const higherPairExists = RANKS.some((r) => r !== rank && getRankValue(r) > currentPairVal)
                        isAvailable = higherPairExists
                      } else {
                        isAvailable = false
                      }
                    }
                    const isCurrent = currentClaimParsed.rank === rank && currentClaimParsed.hand === selectedHand
                    const isSelected = selectedRank === rank

                    return (
                      <div
                        key={rank}
                        className={`px-2 py-1 text-xs rounded border ${
                          isCurrent
                            ? "bg-yellow-200 border-yellow-400 text-yellow-800 font-bold"
                            : isSelected
                              ? "bg-blue-200 border-blue-400 text-blue-800 font-bold"
                              : isAvailable
                                ? "bg-green-100 border-green-300 text-green-700"
                                : "bg-gray-200 border-gray-300 text-gray-400"
                        }`}
                      >
                        {rank}
                      </div>
                    )
                  })}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  <div className="flex items-center gap-4">
                    {currentClaimParsed.rank && currentClaimParsed.hand === selectedHand && (
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-yellow-200 border border-yellow-400 rounded"></div>
                        Current
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                      Available
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-gray-200 border border-gray-300 rounded"></div>
                      Unavailable
                    </span>
                  </div>
                </div>
              </div>

              <Select value={selectedRank} onValueChange={setSelectedRank}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rank" />
                </SelectTrigger>
                <SelectContent>
                  {availableRanks.map((rank) => (
                    <SelectItem key={rank} value={rank}>
                      <div className="flex items-center gap-2">
                        {rank}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isReverseRanking && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-green-500" />
                  Lower cards are better - harder to make the hand
                </p>
              )}
            </div>
          )}

          {selectedHand === "Full House" && (
            <div className="space-y-4">
              {/* Full House Rank Visualization */}
              <div className="p-3 bg-gray-50 rounded-lg border">
                <div className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-blue-500" />
                  Full House Strength (Higher = Better)
                </div>

                {/* Rank strength visualization for first rank (three of a kind) */}
                <div className="mb-3">
                  <div className="text-xs font-medium text-gray-700 mb-1">Three of a Kind Rank</div>
                  <div className="flex flex-wrap gap-1">
                    {RANKS.map((rank) => {
                      let isAvailable = availableRanks.includes(rank)
                      if (selectedHand === "Full House" && currentClaimParsed.hand === "Full House" && currentClaimParsed.rank) {
                        const tripVal = getRankValue(rank)
                        const currentTripVal = getRankValue(currentClaimParsed.rank)
                        const currentPairVal = getRankValue(currentClaimParsed.secondRank)

                        if (tripVal > currentTripVal) {
                          isAvailable = true
                        } else if (tripVal === currentTripVal) {
                          // Need at least one higher possible pair
                          const higherPairExists = RANKS.some((r) => r !== rank && getRankValue(r) > currentPairVal)
                          isAvailable = higherPairExists
                        } else {
                          isAvailable = false
                        }
                      }
                      const isCurrent = currentClaimParsed.rank === rank && currentClaimParsed.hand === selectedHand
                      const isSelected = selectedRank === rank

                      return (
                        <div
                          key={rank}
                          className={`px-2 py-1 text-xs rounded border ${
                            isCurrent
                              ? "bg-yellow-200 border-yellow-400 text-yellow-800 font-bold"
                              : isSelected
                                ? "bg-blue-200 border-blue-400 text-blue-800 font-bold"
                                : isAvailable
                                  ? "bg-green-100 border-green-300 text-green-700"
                                  : "bg-gray-200 border-gray-300 text-gray-400"
                          }`}
                        >
                          {rank}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Rank strength visualization for second rank (pair) */}
                {selectedRank && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-gray-700 mb-1">Pair Rank</div>
                    <div className="flex flex-wrap gap-1">
                      {RANKS.map((rank) => {
                        const isAvailable = availableSecondRanks.includes(rank)
                        const isCurrent =
                          currentClaimParsed.secondRank === rank && currentClaimParsed.hand === selectedHand
                        const isSelected = selectedSecondRank === rank

                        return (
                          <div
                            key={rank}
                            className={`px-2 py-1 text-xs rounded border ${
                              isCurrent
                                ? "bg-yellow-200 border-yellow-400 text-yellow-800 font-bold"
                                : isSelected
                                  ? "bg-blue-200 border-blue-400 text-blue-800 font-bold"
                                  : isAvailable
                                    ? "bg-green-100 border-green-300 text-green-700"
                                    : "bg-gray-200 border-gray-300 text-gray-400"
                            }`}
                          >
                            {rank}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Legend */}
                <div className="mt-2 text-xs text-gray-500">
                  <div className="flex items-center gap-4 mb-2">
                    {currentClaimParsed.rank && currentClaimParsed.hand === selectedHand && (
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-yellow-200 border border-yellow-400 rounded"></div>
                        Current
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                      Available
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-gray-200 border border-gray-300 rounded"></div>
                      Unavailable
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    <div className="mb-1">1. Compare the three-of-a-kind first</div>
                    <div>2. If equal, compare the pair</div>
                  </div>
                </div>

                {/* Current and Selected Display */}
                {currentClaim && currentClaimParsed.hand === selectedHand && (
                  <div className="mt-3 p-2 bg-yellow-100 border border-yellow-300 rounded">
                    <div className="text-xs font-medium text-yellow-800 mb-1">Current Claim</div>
                    <div className="text-sm font-bold text-yellow-900">
                      {currentClaimParsed.rank}s over {currentClaimParsed.secondRank}s
                    </div>
                  </div>
                )}

                {selectedRank && selectedSecondRank && (
                  <div className="mt-2 p-2 bg-blue-100 border border-blue-300 rounded">
                    <div className="text-xs font-medium text-blue-800 mb-1">Your Selection</div>
                    <div className="text-sm font-bold text-blue-900">
                      {selectedRank}s over {selectedSecondRank}s
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">First Rank (Three Cards)</label>
                <Select value={selectedRank} onValueChange={setSelectedRank}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rank for three cards" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRanks.map((rank) => (
                      <SelectItem key={rank} value={rank}>
                        {rank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Second Rank (Two Cards)</label>
                <Select value={selectedSecondRank} onValueChange={setSelectedSecondRank}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rank for two cards" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSecondRanks.map((rank) => (
                      <SelectItem key={rank} value={rank}>
                        {rank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {selectedHand === "Two Pair" && (
            <div className="space-y-4">
              {/* Two Pair Rank Visualization */}
              <div className="p-3 bg-gray-50 rounded-lg border">
                <div className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-blue-500" />
                  Two Pair Strength (Higher = Better)
                </div>

                {/* First pair rank visualization */}
                <div className="mb-3">
                  <div className="text-xs font-medium text-gray-700 mb-1">First Pair Rank</div>
                  <div className="flex flex-wrap gap-1">
                    {RANKS.map((rank) => {
                      const isAvailable = availableRanks.includes(rank)
                      const isCurrent = currentClaimParsed.rank === rank && currentClaimParsed.hand === selectedHand
                      const isSelected = selectedRank === rank

                      return (
                        <div
                          key={rank}
                          className={`px-2 py-1 text-xs rounded border ${
                            isCurrent
                              ? "bg-yellow-200 border-yellow-400 text-yellow-800 font-bold"
                              : isSelected
                                ? "bg-blue-200 border-blue-400 text-blue-800 font-bold"
                                : isAvailable
                                  ? "bg-green-100 border-green-300 text-green-700"
                                  : "bg-gray-200 border-gray-300 text-gray-400"
                          }`}
                        >
                          {rank}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Second pair rank visualization */}
                <div className="mb-3">
                  <div className="text-xs font-medium text-gray-700 mb-1">Second Pair Rank</div>
                  <div className="flex flex-wrap gap-1">
                    {RANKS.map((rank) => {
                      const isAvailable = availableSecondRanks.includes(rank)
                      const isCurrent =
                        currentClaimParsed.secondRank === rank && currentClaimParsed.hand === selectedHand
                      const isSelected = selectedSecondRank === rank

                      return (
                        <div
                          key={rank}
                          className={`px-2 py-1 text-xs rounded border ${
                            isCurrent
                              ? "bg-yellow-200 border-yellow-400 text-yellow-800 font-bold"
                              : isSelected
                                ? "bg-blue-200 border-blue-400 text-blue-800 font-bold"
                                : isAvailable
                                  ? "bg-green-100 border-green-300 text-green-700"
                                  : "bg-gray-200 border-gray-300 text-gray-400"
                          }`}
                        >
                          {rank}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-2 text-xs text-gray-500">
                  <div className="flex items-center gap-4 mb-2">
                    {currentClaimParsed.rank && currentClaimParsed.hand === selectedHand && (
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-yellow-200 border border-yellow-400 rounded"></div>
                        Current
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                      Available
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-gray-200 border border-gray-300 rounded"></div>
                      Unavailable
                    </span>
                  </div>
                </div>
              </div>

              {/* Selectors */}
              <div>
                <label className="text-sm font-medium mb-2 block">First Pair Rank</label>
                <Select value={selectedRank} onValueChange={setSelectedRank}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rank for first pair" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRanks.map((rank) => (
                      <SelectItem key={rank} value={rank}>
                        {rank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Second Pair Rank</label>
                <Select value={selectedSecondRank} onValueChange={setSelectedSecondRank}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rank for second pair" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSecondRanks.map((rank) => (
                      <SelectItem key={rank} value={rank}>
                        {rank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {needsSuit && (
            <div>
              <label className="text-sm font-medium mb-2 block">Suit</label>
              <Select value={selectedSuit} onValueChange={setSelectedSuit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select suit" />
                </SelectTrigger>
                <SelectContent>
                  {SUITS.map((suit) => (
                    <SelectItem key={suit} value={suit}>
                      {suit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {currentClaim && (
            <div className="text-sm text-muted-foreground">
              Current claim: <strong>{currentClaimParsed.hand === "Two Pair" ? `Two Pair of ${currentClaimParsed.rank}s and ${currentClaimParsed.secondRank}s` : currentClaim}</strong>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={
              !selectedHand ||
              (needsRank && !selectedRank) ||
              (needsSecondRank && !selectedSecondRank) ||
              (needsSuit && !selectedSuit)
            }
          >
            Make Claim
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
