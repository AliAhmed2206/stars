"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useProfile } from "@/lib/useProfile"
import { Sparkles, Mail, Loader2, Check } from "lucide-react"

export default function AuthPage() {
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsUsername, setNeedsUsername] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { user, profile, loading: profileLoading } = useProfile()

  useEffect(() => {
    if (profileLoading) return
    if (user) {
      if (profile && profile.username) {
        router.push("/")
      } else {
        setNeedsUsername(true)
      }
    }
  }, [user, profile, profileLoading])

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    if (err) {
      setError(err.message)
    } else {
      setMagicSent(true)
    }
    setLoading(false)
  }

  async function handleGoogleSignIn() {
    setLoading(true)
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/auth" } })
    setLoading(false)
  }

  async function handleSetUsername() {
    if (!username.trim() || !user) return
    setLoading(true)
    await supabase.from("profiles").upsert({ id: user.id, username: username.trim() })
    router.push("/")
    router.refresh()
  }

  if (profileLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>
  }

  if (needsUsername) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="glass rounded-3xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent via-accent2 to-accent3 animate-gradient flex items-center justify-center mb-4 mx-auto animate-glow">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-2"><span className="text-gradient">Welcome!</span></h1>
            <p className="text-muted text-sm mb-6">Set your display name for STARS</p>
            <div className="relative mb-4">
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="Your name"
                className="w-full bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors text-center"
                autoFocus onKeyDown={(e) => e.key === "Enter" && handleSetUsername()} />
            </div>
            <button onClick={handleSetUsername} disabled={loading || !username.trim()}
              className="btn-primary w-full py-3 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Join STARS
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="glass rounded-3xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent via-accent2 to-accent3 animate-gradient flex items-center justify-center mb-4 animate-glow">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold">
              <span className="text-gradient">Welcome to</span> STARS
            </h1>
            <p className="text-muted text-sm mt-1">Sign in to join the crew</p>
          </div>

          {magicSent ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-success" />
              </div>
              <p className="text-lg font-semibold mb-2">Check your email</p>
              <p className="text-sm text-muted">A magic link was sent to <strong className="text-foreground">{email}</strong></p>
            </div>
          ) : (
            <>
              <button onClick={handleGoogleSignIn} disabled={loading}
                className="w-full py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-3 glass glass-hover mb-6 transition-all disabled:opacity-50">
                <span className="w-5 h-5 flex items-center justify-center font-bold text-sm">G</span>
                Sign in with Google
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={handleMagicLink} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full bg-background border border-border rounded-2xl py-3 pl-12 pr-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors"
                    required />
                </div>
                {error && <p className="text-sm text-danger text-center">{error}</p>}
                <button type="submit" disabled={loading || !email.trim()}
                  className="btn-primary w-full py-3 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send Magic Link
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
