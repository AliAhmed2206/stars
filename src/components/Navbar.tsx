"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { Menu, X, Sparkles, CalendarDays, Trophy, Gamepad2, Users, User, Shield } from "lucide-react"
import type { User as UserType } from "@supabase/supabase-js"

const navItems = [
  { href: "/", label: "Home", icon: Sparkles },
  { href: "/championship", label: "Championship", icon: Trophy },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/players", label: "Players", icon: Users },
]

export default function Navbar() {
  const pathname = usePathname()
  const [user, setUser] = useState<UserType | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single()
        if (profile) setIsAdmin(profile.role === "admin")
      }
    }
    load()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) setIsAdmin(false)
    })
    return () => listener?.subscription.unsubscribe()
  }, [])

  return (
    <nav className="sticky top-0 z-50 glass border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent via-accent2 to-accent3 animate-gradient flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-gradient">STARS</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2",
                    isActive
                      ? "bg-white/10 text-accent"
                      : "text-muted hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              )
            })}
            {isAdmin && (
              <Link
                href="/admin"
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2",
                  pathname === "/admin"
                    ? "bg-white/10 text-accent"
                    : "text-muted hover:text-foreground hover:bg-white/5"
                )}
              >
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/profile"
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200",
                  pathname === "/profile"
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "bg-card border border-border text-muted hover:text-foreground hover:border-accent/30"
                )}
              >
                <User className="w-4 h-4" />
              </Link>
            ) : (
              <Link href="/auth" className="btn-primary px-4 py-2 rounded-xl text-sm">
                Sign In
              </Link>
            )}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted"
            >
              {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-border">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                    isActive
                      ? "bg-white/10 text-accent"
                      : "text-muted hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              )
            })}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  pathname === "/admin"
                    ? "bg-white/10 text-accent"
                    : "text-muted hover:text-foreground hover:bg-white/5"
                )}
              >
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
