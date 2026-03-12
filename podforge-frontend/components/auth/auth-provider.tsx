'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import { fetchCredits, type CreditsInfo } from '@/lib/api'

interface AuthContextType {
  user: User | null
  session: Session | null
  credits: CreditsInfo
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshCredits: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [credits, setCredits] = useState<CreditsInfo>({ remaining: 0, plan: 'FREE', unlimited: false })
  const [loading, setLoading] = useState(true)

  const refreshCredits = useCallback(async () => {
    const c = await fetchCredits()
    setCredits(c)
  }, [])

  // Inicializar sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Refrescar créditos al cambiar sesión
  useEffect(() => {
    refreshCredits()
  }, [session, refreshCredits])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    await refreshCredits()
    return { error: null }
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setCredits({ remaining: 0, plan: 'FREE', unlimited: false })
    await refreshCredits() // Gets anonymous credits
  }

  return (
    <AuthContext.Provider value={{ user, session, credits, loading, signIn, signUp, signOut, refreshCredits }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
