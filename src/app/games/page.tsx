"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Game, GameFormat } from "@/lib/types"
import { Gamepad2, Trophy, Info } from "lucide-react"
import Link from "next/link"

const categoryConfig: Record<string, { label: string; color: string }> = {
  playstation: { label: "PlayStation", color: "from-blue-500 to-blue-700" },
  football: { label: "Football", color: "from-green-500 to-green-700" },
  padel: { label: "Padel", color: "from-orange-400 to-orange-600" },
  esports: { label: "Esports", color: "from-accent to-cyan-500" },
  card_games: { label: "Card Games", color: "from-accent3 to-pink-500" },
}

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([])
  const [formats, setFormats] = useState<Record<string, GameFormat[]>>({})
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: gamesData } = await supabase
      .from("games")
      .select("*")
      .order("name")

    if (gamesData) {
      setGames(gamesData as Game[])
      // Load formats for each game
      const formatsMap: Record<string, GameFormat[]> = {}
      for (const game of gamesData) {
        const { data: fData } = await supabase
          .from("game_formats")
          .select("*")
          .eq("game_id", game.id)
          .order("name")
        if (fData) formatsMap[game.id] = fData as GameFormat[]
      }
      setFormats(formatsMap)
    }
  }

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
        <p className="text-muted text-sm mt-1">Browse games & their tournament formats</p>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <Gamepad2 className="w-12 h-12 text-muted mx-auto mb-4" />
          <p className="text-muted">No games configured yet</p>
        </div>
      ) : (
        Object.entries(grouped).map(([category, categoryGames]) => {
          const config = categoryConfig[category] || { label: category, color: "from-gray-500 to-gray-700" }
          return (
            <div key={category} className="mb-12">
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${config.color}`} />
                <h2 className="text-xl font-bold">{config.label}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryGames.map((game) => (
                  <div key={game.id} className="glass rounded-2xl overflow-hidden group">
                    {game.image_url && (
                      <div className="h-32 bg-card overflow-hidden">
                        <img
                          src={game.image_url}
                          alt={game.name}
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xl">{game.icon}</span>
                        <h3 className="font-semibold text-lg">{game.name}</h3>
                      </div>
                      {game.description && (
                        <p className="text-xs text-muted mb-3">{game.description}</p>
                      )}
                      {formats[game.id] && formats[game.id].length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted font-medium">Formats:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {formats[game.id].map((f) => (
                              <Link
                                key={f.id}
                                href={`/championship`}
                                className="px-2.5 py-1 rounded-lg bg-card text-xs text-muted hover:text-accent transition-colors border border-border"
                              >
                                {f.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
