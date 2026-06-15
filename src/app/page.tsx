"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Game } from "@/lib/types"
import Link from "next/link"
import { Sparkles, CalendarDays, Trophy, Gamepad2, Users, ArrowRight, Star, Flame, Zap } from "lucide-react"

const quickLinks = [
  {
    href: "/planner",
    icon: CalendarDays,
    title: "Summer Planner",
    desc: "Plan night outs & gatherings",
    gradient: "from-sky-400 via-cyan-400 to-teal-400",
    glow: "rgba(0, 240, 255, 0.3)",
  },
  {
    href: "/championship",
    icon: Trophy,
    title: "Championship",
    desc: "Tournaments & brackets",
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    glow: "rgba(180, 0, 255, 0.3)",
  },
  {
    href: "/games",
    icon: Gamepad2,
    title: "Games",
    desc: "All games & categories",
    gradient: "from-pink-500 via-rose-500 to-red-500",
    glow: "rgba(255, 0, 128, 0.3)",
  },
  {
    href: "/players",
    icon: Users,
    title: "Players",
    desc: "Leaderboard & stats",
    gradient: "from-amber-400 via-orange-400 to-red-400",
    glow: "rgba(255, 200, 0, 0.3)",
  },
]

const gameEmojis: Record<string, string> = {
  "Brawl Stars": "⭐",
  "eFootball": "⚽",
  "FC Mobile": "📱",
  "PlayStation 5": "🎮",
  "Padel": "🎾",
  "Skrew": "🃏",
  "Casino (Poker)": "🃏",
  "Casino (Blackjack)": "🃏",
  "Football 11v11": "🏟️",
  "Football 5v5": "⚽",
  "FC 26": "⚽",
}

export default function Home() {
  const [featuredGames, setFeaturedGames] = useState<Game[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase.from("games").select("*").limit(8).order("name").then(({ data }) => {
      if (data) setFeaturedGames(data as Game[])
    })
  }, [])

  return (
    <div className="min-h-screen">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,240,255,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_120%,rgba(180,0,255,0.1),transparent)]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent2/5 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: "2s" }} />
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="absolute w-1 h-1 bg-white/10 rounded-full animate-float" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDuration: `${3 + Math.random() * 4}s`,
            animationDelay: `${Math.random() * 5}s`,
            width: `${1 + Math.random() * 3}px`,
            height: `${1 + Math.random() * 3}px`,
          }} />
        ))}
      </div>

      <div className="relative z-10">
        {/* Hero */}
        <section className="relative overflow-hidden pt-20 sm:pt-32 pb-16 sm:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-medium mb-8 animate-float">
                <Sparkles className="w-4 h-4" />
                Summer 2026 — The crew is ready
              </div>
              <h1 className="text-6xl sm:text-8xl font-black tracking-tight mb-6 leading-[1.1]">
                <span className="text-gradient">STARS</span>
                <br />
                <span className="text-white">Summer Championship</span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed">
                The ultimate hub for the crew. Plan night outs, compete in tournaments,
                and track every match — all in real-time.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/planner" className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold text-white overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-accent via-accent2 to-accent3 bg-[length:200%_100%] animate-gradient" />
                  <div className="relative flex items-center gap-2">
                    <CalendarDays className="w-5 h-5" />
                    Plan the Summer
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
                <Link href="/championship" className="group relative inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold overflow-hidden">
                  <div className="absolute inset-0 bg-white/5 border border-white/10 rounded-2xl" />
                  <div className="absolute inset-0 bg-white/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-accent" />
                    <span className="text-white">View Championship</span>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}
                className="group relative rounded-2xl p-6 overflow-hidden transition-all duration-500 hover:-translate-y-2"
                style={{ boxShadow: `0 0 0px ${link.glow}` }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 20px 60px ${link.glow}` }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = `0 0 0px transparent` }}
              >
                <div className="absolute inset-0 bg-[#12121a] border border-white/5 rounded-2xl" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent rounded-2xl" />
                <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r ${link.gradient}`} />
                <div className="relative">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${link.gradient} flex items-center justify-center mb-5 shadow-lg`}>
                    <link.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{link.title}</h3>
                  <p className="text-sm text-gray-400">{link.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured Games */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-black text-white">
                Featured <span className="text-gradient">Games</span>
              </h2>
              <p className="text-gray-400 text-sm mt-1">Jump into a tournament</p>
            </div>
            <Link href="/championship" className="hidden sm:flex items-center gap-2 text-sm text-gray-400 hover:text-accent transition-colors">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredGames.map((game, i) => (
              <Link key={game.id} href="/championship"
                className="group relative rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-1"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="absolute inset-0 bg-[#12121a] border border-white/5 rounded-2xl group-hover:border-white/20 transition-colors" />
                <div className="relative p-5">
                  {game.image_url ? (
                    <div className="w-full h-20 mb-4 rounded-xl overflow-hidden bg-white/5">
                      <img src={game.image_url} alt={game.name}
                        className="w-full h-full object-contain p-2 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                    </div>
                  ) : (
                    <div className="w-full h-20 mb-4 rounded-xl bg-white/5 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform duration-500">
                      {gameEmojis[game.name] || game.icon || "🎮"}
                    </div>
                  )}
                  <h3 className="font-bold text-white text-sm truncate">{game.name}</h3>
                  <p className="text-xs text-gray-500 capitalize mt-1">{game.category.replace(/_/g, " ")}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="sm:hidden mt-6 text-center">
            <Link href="/championship" className="inline-flex items-center gap-2 text-sm text-accent">
              View all games <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Stats / Energy */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Active Players", value: "19", icon: Users, color: "from-accent to-cyan-400" },
              { label: "Tournaments", value: "Live", icon: Trophy, color: "from-accent2 to-purple-400" },
              { label: "Games", value: `${featuredGames.length}+`, icon: Gamepad2, color: "from-accent3 to-pink-400" },
              { label: "Energy", value: "Max", icon: Zap, color: "from-yellow-400 to-orange-400" },
            ].map((stat) => (
              <div key={stat.label} className="relative rounded-2xl p-5 overflow-hidden">
                <div className="absolute inset-0 bg-[#12121a] border border-white/5 rounded-2xl" />
                <div className="relative">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-2xl font-black text-white">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
