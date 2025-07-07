"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlayingCard } from "@/components/playing-card"
// Icons removed per plain text requirement
import { Player } from "@/types"
import { ClaimString } from "./ui/claim-string"

interface BSRevealProps {
  players: Player[]
  communityCards: Array<{ suit: string; rank: string }>
  revealedBoardFlags: boolean[]
  currentClaim: string
  revealedPlayerCards: Record<string, Array<{ suit: string; rank: string }>>
  claimValid: boolean
  loser: string
  onComplete: () => void
  canAck?: boolean
  autoCompleteAfterMS?: number
}

export function BSReveal({ players, communityCards, revealedBoardFlags, currentClaim, revealedPlayerCards, claimValid, loser, onComplete, canAck = true, autoCompleteAfterMS }: BSRevealProps) {
  const [showResult, setShowResult] = useState(false)
  const [revealedMap, setRevealedMap] = useState<Record<string, boolean>>({})
  const [readyClicked, setReadyClicked] = useState(false)

  // ===== Helper poker utilities duplicated from server for client-side highlighting =====
  const RANK_VALUES = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"] as const
  const cardValue = (rank: string) => RANK_VALUES.indexOf(rank as any)

  type ParsedClaim = { category: string; rank?: string; secondRank?: string; pairRank?: string; suit?: string }

  const parseClaimString = (str: string): ParsedClaim | null => {
    if (!str) return null
    const lc = str.toLowerCase()
    const rankFromWord = (w: string) => w.replace(/s$/,'').toUpperCase()
    // Detect implicit Full House claims like "As over 10s"
    const fhImplicit = str.match(/([0-9A-Za-z]+)s over ([0-9A-Za-z]+)s/i)
    if (fhImplicit) {
      const r1 = rankFromWord(fhImplicit[1])
      const r2 = rankFromWord(fhImplicit[2])
      if (r1 !== r2) return { category: 'full_house', rank: r1, pairRank: r2 }
    }
    // Handle "Two Pair" before generic "Pair" to avoid false positives.
    if (lc.includes('two pair')) {
      const m = str.match(/Two Pair of ([0-9A-Za-z]+)s and ([0-9A-Za-z]+)s/i)
      if (m) {
        const r1=rankFromWord(m[1]); const r2=rankFromWord(m[2])
        const high = cardValue(r1) >= cardValue(r2)? r1: r2
        const low = high===r1? r2: r1
        return { category: 'two_pair', rank: high, secondRank: low }
      }
      return { category: 'two_pair' }
    }
    if (lc.includes('pair of')) {
      const rank = rankFromWord(str.split('Pair of ')[1])
      return { category: 'pair', rank }
    }
    if (lc.includes('three of a kind')) {
      const m=str.match(/Three of a Kind of ([0-9A-Za-z]+)s/i)
      return { category: 'three_of_a_kind', rank: m? rankFromWord(m[1]): undefined }
    }
    if (lc.includes('four of a kind')) {
      const m=str.match(/Four of a Kind of ([0-9A-Za-z]+)s/i)
      return { category: 'four_of_a_kind', rank: m? rankFromWord(m[1]): undefined }
    }
    if (lc.includes('full house')) {
      const m=str.match(/([0-9A-Za-z]+)s over ([0-9A-Za-z]+)s/i)
      if (m) return { category: 'full_house', rank: rankFromWord(m[1]), pairRank: rankFromWord(m[2]) }
    }
    if (lc.includes('-high straight')) {
      const rank = rankFromWord(str.split('-high')[0])
      return { category: 'straight', rank }
    }
    if (lc.includes('-high') && lc.includes('flush')) {
      const parts=str.split('-high ')
      const rankPart=parts[0]
      const rest=parts[1]
      const suitMatch=rest.match(/(Hearts|Diamonds|Clubs|Spades)/i)
      const suit=suitMatch? suitMatch[1].toLowerCase(): undefined
      if(rest.toLowerCase().includes('straight flush')) {
        return { category: 'straight_flush', rank: rankFromWord(rankPart), suit }
      }
      return { category: 'flush', rank: rankFromWord(rankPart), suit }
    }
    if (lc.includes('-high card')) {
      const rank = rankFromWord(str.split('-high')[0])
      return { category: 'high_card', rank }
    }
    if (lc.includes('straight flush')) return { category: 'straight_flush' }
    if (lc.includes('royal flush')) {
      const suitMatch = str.match(/(Hearts|Diamonds|Clubs|Spades)/i)
      const suit = suitMatch? suitMatch[1].toLowerCase(): undefined
      return { category: 'royal_flush', suit }
    }
    return null
  }

  interface CardObj { rank: string; suit: string }

  const getContributingCards = (claim: string, cards: CardObj[]): Set<string> => {
    const parsed = parseClaimString(claim)
    const set = new Set<string>()
    if (!parsed) return set

    const addCard = (c: CardObj, neededCount?: number) => {
      const key = `${c.rank}-${c.suit}`
      if (!set.has(key)) set.add(key)
    }

    const findCards = (filterFn: (c: CardObj)=>boolean, count:number) => {
      cards.filter(filterFn).slice(0,count).forEach(addCard)
    }

    switch(parsed.category){
      case 'high_card':
        findCards(c=>c.rank===parsed.rank,1); break
      case 'pair':
        findCards(c=>c.rank===parsed.rank,2); break
      case 'two_pair':
        findCards(c=>c.rank===parsed.rank,2);
        parsed.secondRank && findCards(c=>c.rank===parsed.secondRank,2);
        break;
      case 'three_of_a_kind':
        findCards(c=>c.rank===parsed.rank,3); break
      case 'four_of_a_kind':
        findCards(c=>c.rank===parsed.rank,4); break
      case 'full_house':
        findCards(c=>c.rank===parsed.rank,3);
        parsed.pairRank && findCards(c=>c.rank===parsed.pairRank,2);
        break;
      case 'straight': {
        if(!parsed.rank) break
        const highIdx=RANK_VALUES.indexOf(parsed.rank as any)
        const seqRanks= parsed.rank==='5'? ['A','2','3','4','5'] : RANK_VALUES.slice(highIdx-4, highIdx+1)
        seqRanks.forEach(r=>{
          const card = cards.find(c=>c.rank===r)
          if(card) addCard(card)
        })
        break
      }
      case 'flush': {
        if(!parsed.rank) break
        const suit = parsed.suit || cards.find(c=>c.rank===parsed.rank)?.suit
        if(!suit) break
        const targetVal = cardValue(parsed.rank)
        // Keep only cards in the suit that are <= claimed high card
        const suited = cards
          .filter(c=>c.suit===suit && cardValue(c.rank) <= targetVal)
          .sort((a,b)=>cardValue(b.rank)-cardValue(a.rank))
        suited.slice(0,5).forEach(addCard)
        break
      }
      case 'straight_flush': {
        if(!parsed.rank) break
        const suitsToCheck = parsed.suit ? [parsed.suit] : ['clubs','diamonds','hearts','spades']
        for(const s of suitsToCheck){
          const suitedCards = cards.filter(c=>c.suit===s)
          if(suitedCards.length<2) continue // need at least some cards to highlight
          const seq = parsed.rank==='5' ? ['A','2','3','4','5'] : RANK_VALUES.slice(RANK_VALUES.indexOf(parsed.rank as any)-4, RANK_VALUES.indexOf(parsed.rank as any)+1)
          seq.forEach(r => {
            const card = suitedCards.find(c=>c.rank===r)
            if(card) addCard(card)
          })
        }
        break
      }
      case 'royal_flush': {
        const suit = parsed.suit
        const needed=['10','J','Q','K','A']
        const sc=cards.filter(c=>c.suit===suit)
        needed.forEach(r=>{
          const card=sc.find(c=>c.rank===r)
          if(card) addCard(card)
        })
        break
      }
    }
    return set
  }

  const highlightSet = useMemo(()=>{
    const boardCards = communityCards.filter((_,idx)=>revealedBoardFlags[idx])
    const playerCards = Object.values(revealedPlayerCards).flat()
    return getContributingCards(currentClaim, [...boardCards, ...playerCards])
  }, [communityCards, revealedBoardFlags, revealedPlayerCards, currentClaim])

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

  // Auto-complete timer when specified (e.g., winner detected)
  useEffect(() => {
    if (autoCompleteAfterMS === undefined) return
    const t = setTimeout(() => onComplete(), autoCompleteAfterMS)
    return () => clearTimeout(t)
  }, [autoCompleteAfterMS, onComplete])

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-6xl mx-auto">
        <Card className="bg-black border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-white">BS Called!</CardTitle>
            <p className="text-sm text-gray-400">{showResult ? "Revealed all cards!" : "Revealing all cards..."}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Community Cards */}
            <div className="text-center">
              <h3 className="text-base font-semibold mb-2 text-white">Community Cards</h3>
              <div className="flex justify-center gap-2">
                {communityCards.map((card, index) => {
                  const keyStr = `${card.rank}-${card.suit}`
                  return (
                    <PlayingCard
                      key={index}
                      suit={card.suit}
                      rank={card.rank}
                      isRevealed={revealedBoardFlags[index]}
                      highlighted={showResult && highlightSet.has(keyStr)}
                    />
                  )
                })}
              </div>
            </div>

            {/* Player Cards */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-center text-white">Player Cards</h3>
              {players.map((player) => (
                <div key={player.id} className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white text-sm">{player.name}</span>
                    <span className="text-gray-400 text-xs">{player.cardCount}</span>
                  </div>
                  <div className="flex gap-2">
                    {revealedPlayerCards[player.id]
                      ? revealedPlayerCards[player.id].map((card, index) => (
                          <PlayingCard
                            key={index}
                            suit={card.suit}
                            rank={card.rank}
                            isRevealed={!!revealedMap[`${player.id}-${index}`]}
                            highlighted={showResult && highlightSet.has(`${card.rank}-${card.suit}`)}
                          />
                        ))
                      : Array.from({ length: player.cardCount ?? 0 }).map((_, index) => (
                          <PlayingCard key={index} suit="" rank="" isRevealed={false} />
                        ))}
                  </div>
                </div>
              ))}
            </div>

            {/* BS Result */}
            {showResult && (
              <div className="text-center space-y-2">
                <div className={`text-xl font-bold ${claimValid ? "text-green-500" : "text-red-500"}`}>
                  {claimValid ? "BS Valid!" : "BS Invalid!"}
                </div>

                <div className="text-sm text-gray-300">
                  Claimed: <strong><ClaimString text={currentClaim} /></strong>
                </div>

                <div className="text-sm text-gray-300">
                  {claimValid
                    ? <>The claimed <ClaimString text={currentClaim} /> does not exist. The claimer gets an extra card.</>
                    : <>The claimed <ClaimString text={currentClaim} /> exists. The BS caller gets an extra card.</>}
                </div>

                {canAck && !autoCompleteAfterMS && (
                  <Button
                    onClick={handleContinue}
                    size="lg"
                    className={`mt-4 ${readyClicked ? "bg-gray-600 rounded-full" : "bg-green-600 hover:bg-green-700 rounded-full"}`}
                    disabled={readyClicked}
                  >
                    ready
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}