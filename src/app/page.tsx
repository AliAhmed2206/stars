"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Game } from "@/lib/types"
import Link from "next/link"
import { Sparkles, CalendarDays, Trophy, Gamepad2, Users, ArrowRight, Star, TrophyIcon } from "lucide-react"

const quickLinks = [
  {
    href: "/planner",
    icon: CalendarDays,
    title: "Summer Planner",
    desc: "Plan night outs & gatherings",
    color: "from-accent to-cyan-400",
  },
  {
    href: "/championship",
    icon: Trophy,
    title: "Championship",
    desc: "Tournaments & brackets",
    color: "from-accent2 to-purple-400",
  },
  {
    href: "/games",
    icon: Gamepad2,
    title: "Games",
    desc: "All games & categories",
    color: "from-accent3 to-pink-400",
  },
  {
    href: "/players",
    icon: Users,
    title: "Players",
    desc: "Leaderboard & stats",
    color: "from-yellow-400 to-orange-400",
  },
]

export default function Home() {
  const [featuredGames, setFeaturedGames] = useState<Game[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase.from("games").select("*").limit(8).order("name").then(({ data }) => {
      if (data) setFeaturedGames(data as Game[])
    })
  }, [])

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/5 via-transparent to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm text-muted mb-6 animate-float">
              <Star className="w-3.5 h-3.5 text-accent" />
              Summer 2026 — Let the games begin
            </div>
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-6">
              <span className="text-gradient">STARS</span>
              <br />
              <span className="text-foreground">Summer Championship</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted max-w-xl mb-10">
              The ultimate hub for the crew. Plan night outs, compete in tournaments,
              and track every match — all in real-time.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/planner" className="btn-primary px-8 py-3 rounded-2xl text-base flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Plan the Summer
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/championship" className="btn-secondary px-8 py-3 rounded-2xl text-base flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                View Championship
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="glass rounded-2xl p-6 glass-hover transition-all duration-300 group"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center mb-4 animate-glow`}>
                <link.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{link.title}</h3>
              <p className="text-sm text-muted">{link.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <h2 className="text-2xl font-bold mb-6">
          <span className="text-gradient">Featured</span> Games
        </h2>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-4">
          {featuredGames.map((game) => (
            <Link
              key={game.id}
              href="/championship"
              className="flex-shrink-0 w-48 glass rounded-2xl overflow-hidden glass-hover group"
            >
              {game.image_url && (
                <div className="h-24 bg-card overflow-hidden">
                  <img
                    src={game.image_url}
                    alt={game.name}
                    className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-opacity"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              )}
              <div className="p-4 flex items-center gap-3">
                <span className="text-xl">{game.icon}</span>
                <div>
                  <p className="font-semibold text-sm">{game.name}</p>
                  <p className="text-xs text-muted capitalize">{game.category}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
