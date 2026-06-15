"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"

const STORAGE_KEY = "stars-profile"

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setProfile(JSON.parse(stored))
      } catch {}
    }
    setLoading(false)
  }, [])

  function selectProfile(p: Profile) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    setProfile(p)
  }

  function clearProfile() {
    localStorage.removeItem(STORAGE_KEY)
    setProfile(null)
  }

  async function refreshProfile() {
    if (!profile) return
    const { data } = await supabase.from("profiles").select("*").eq("id", profile.id).single()
    if (data) {
      const p = data as Profile
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
      setProfile(p)
    }
  }

  return { profile, loading, selectProfile, clearProfile, refreshProfile }
}
