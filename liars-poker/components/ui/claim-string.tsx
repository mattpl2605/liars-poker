"use client"

import React from "react"

export const ClaimString: React.FC<{ text: string | null }> = ({ text }) => {
  if (!text) return null

  const words = text.split(" ")

  return (
    <>
      {words.map((word, i) => {
        const isFaceCardRank = /^(k|q|j|a)((s)|(-high))?$/i.test(word)
        const isArticleA = word.toLowerCase() === "a"

        const space = i < words.length - 1 ? " " : ""

        if (isFaceCardRank && !isArticleA) {
          return (
            <React.Fragment key={i}>
              <span className="uppercase">{word.charAt(0)}</span>
              {word.slice(1)}
              {space}
            </React.Fragment>
          )
        }
        return (
          <React.Fragment key={i}>
            {word}
            {space}
          </React.Fragment>
        )
      })}
    </>
  )
} 