"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Event } from "@/lib/types"
import { Plus, MapPin, Clock, Trash2, CalendarDays, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { format, parseISO } from "date-fns"

export default function PlannerPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [location, setLocation] = useState("")
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    loadEvents()

    const channel = supabase
      .channel("events-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        loadEvents()
      })
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [])

  async function loadEvents() {
    const { data } = await supabase
      .from("events")
      .select("*")
      .order("date", { ascending: true })
    if (data) setEvents(data as Event[])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    await supabase.from("events").insert([{
      title,
      description,
      date,
      time: time || null,
      location: location || null,
      created_by: user.id,
    }])

    setTitle("")
    setDescription("")
    setDate("")
    setTime("")
    setLocation("")
    setShowForm(false)
  }

  async function handleDelete(id: string) {
    await supabase.from("events").delete().eq("id", id)
  }

  const grouped = events.reduce<Record<string, Event[]>>((acc, event) => {
    const key = event.date
    if (!acc[key]) acc[key] = []
    acc[key].push(event)
    return acc
  }, {})

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="text-gradient">Summer</span> Planner
          </h1>
          <p className="text-muted text-sm mt-1">Plan night outs & gatherings</p>
        </div>
        {user && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary px-5 py-2.5 rounded-2xl text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Event
          </button>
        )}
      </div>

      {showForm && (
        <div className="glass rounded-3xl p-6 mb-8 animate-glow">
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Event title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50"
              required
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 resize-none h-20"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground focus:outline-none focus:border-accent/50"
                required
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground focus:outline-none focus:border-accent/50"
              />
              <input
                type="text"
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary px-6 py-2.5 rounded-2xl text-sm">Create Event</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary px-6 py-2.5 rounded-2xl text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {Object.keys(grouped).length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <CalendarDays className="w-12 h-12 text-muted mx-auto mb-4" />
          <p className="text-muted">No events planned yet</p>
          {user && (
            <button onClick={() => setShowForm(true)} className="btn-primary px-6 py-2.5 rounded-2xl text-sm mt-4 inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create First Event
            </button>
          )}
        </div>
      ) : (
        Object.entries(grouped).map(([dateKey, dateEvents]) => (
          <div key={dateKey} className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              {format(parseISO(dateKey), "EEEE, MMMM d")}
            </h2>
            <div className="space-y-3">
              {dateEvents.map((event) => (
                <div key={event.id} className="glass rounded-2xl p-5 glass-hover group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{event.title}</h3>
                      {event.description && (
                        <p className="text-sm text-muted mt-1">{event.description}</p>
                      )}
                      <div className="flex flex-wrap gap-4 mt-3">
                        <span className="flex items-center gap-1.5 text-xs text-muted">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {format(parseISO(event.date), "MMM d, yyyy")}
                        </span>
                        {event.time && (
                          <span className="flex items-center gap-1.5 text-xs text-muted">
                            <Clock className="w-3.5 h-3.5" />
                            {event.time}
                          </span>
                        )}
                        {event.location && (
                          <span className="flex items-center gap-1.5 text-xs text-muted">
                            <MapPin className="w-3.5 h-3.5" />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                    {user && (
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-xl hover:bg-danger/10 text-muted hover:text-danger transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
