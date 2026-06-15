"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Game } from "@/lib/types"
import { Gamepad2, Trophy } from "lucide-react"
import Link from "next/link"

const categoryConfig: Record<string, { label: string; color: string; icon: string }> = {
  playstation: { label: "PlayStation", color: "from-blue-500 to-blue-700", icon: "🎮" },
  football: { label: "Football", color: "from-green-500 to-green-700", icon: "⚽" },
  padel: { label: "Padel", color: "from-orange-400 to-orange-600", icon: "🎾" },
  esports: { label: "Esports", color: "from-accent to-cyan-500", icon: "🎯" },
  card_games: { label: "Card Games", color: "from-accent3 to-pink-500", icon: "🃏" },
}

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase.from("games").select("*").order("name").then(({ data }) => {
      if (data) setGames(data as Game[])
    })
  }, [])

  const grouped = games.reduce<Record<string, Game[]>>((acc, game) => {
    if (!acc[game.category]) acc[game.category] = []
    acc[game.category].push(game)
    return acc
  }, {})

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          <span className="text-gradient">All</span> Games
        </h1>
        <p className="text-muted text-sm mt-1">Browse games & start tournaments</p>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <Gamepad2 className="w-12 h-12 text-muted mx-auto mb-4" />
          <p className="text-muted">No games configured yet</p>
          <p className="text-xs text-muted mt-2">
            Games will be available once the Supabase database is set up
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([category, categoryGames]) => {
          const config = categoryConfig[category] || { label: category, color: "from-gray-500 to-gray-700", icon: "🎯" }
          return (
            <div key={category} className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xl">{config.icon}</span>
                <h2 className="text-xl font-bold">{config.label}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryGames.map((game) => (
                  <Link
                    key={game.id}
                    href={`/championship?game=${game.id}`}
                    className="glass rounded-2xl p-5 glass-hover transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center text-xl`}>
                        {config.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{game.name}</h3>
                        <p className="text-xs text-muted">{config.label}</p>
                      </div>
                      <Trophy className="w-4 h-4 text-muted group-hover:text-accent transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
