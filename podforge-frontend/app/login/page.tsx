'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type AuthMode = 'login' | 'register'

interface FieldErrors {
  email?: string
  password?: string
  general?: string
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [success, setSuccess] = useState<string | null>(null)

  const validateForm = (): boolean => {
    const newErrors: FieldErrors = {}
    
    if (!email) {
      newErrors.email = 'El email es requerido'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Ingresa un email válido'
    }
    
    if (!password) {
      newErrors.password = 'La contraseña es requerida'
    } else if (password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    
    setLoading(true)
    setErrors({})
    setSuccess(null)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
        })
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setErrors({ general: 'Credenciales inválidas. Verifica tu email y contraseña.' })
          } else {
            setErrors({ general: error.message })
          }
        } else {
          router.push('/')
        }
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        })
        if (error) {
          if (error.message.includes('already registered')) {
            setErrors({ email: 'Este email ya está registrado' })
          } else {
            setErrors({ general: error.message })
          }
        } else {
          setSuccess('¡Cuenta creada! Revisa tu email para confirmarla.')
        }
      }
    } catch {
      setErrors({ general: 'Ocurrió un error inesperado' })
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: 'google' | 'apple' | 'linkedin_oidc') => {
    setOauthLoading(provider)
    setErrors({})
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })
      if (error) {
        setErrors({ general: error.message })
        setOauthLoading(null)
      }
    } catch {
      setErrors({ general: 'Error al conectar con el proveedor' })
      setOauthLoading(null)
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setErrors({})
    setSuccess(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-1/4 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: '#7c3aed' }}
        />
        <div 
          className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: '#06b6d4' }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back to app link */}
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-sm mb-6 transition-colors"
          style={{ color: '#a1a1aa' }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hover:text-white transition-colors">Volver a la app</span>
        </Link>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border p-8"
          style={{ 
            backgroundColor: '#141414',
            borderColor: '#262626'
          }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-2xl font-semibold text-white mb-2">
                {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </h1>
              <p style={{ color: '#71717a' }}>
                {mode === 'login' 
                  ? 'Accede a tu cuenta de PodForge' 
                  : 'Regístrate para comenzar'}
              </p>
            </motion.div>
          </div>

          {/* OAuth buttons */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={!!oauthLoading}
              className={cn(
                "w-full h-11 rounded-lg border font-medium flex items-center justify-center gap-3 transition-all",
                "hover:border-[#7c3aed]/50 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              style={{ 
                backgroundColor: 'transparent',
                borderColor: '#262626',
                color: '#e4e4e7'
              }}
            >
              {oauthLoading === 'google' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continuar con Google
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleOAuth('apple')}
              disabled={!!oauthLoading}
              className={cn(
                "w-full h-11 rounded-lg border font-medium flex items-center justify-center gap-3 transition-all",
                "hover:border-[#7c3aed]/50 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              style={{ 
                backgroundColor: 'transparent',
                borderColor: '#262626',
                color: '#e4e4e7'
              }}
            >
              {oauthLoading === 'apple' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Continuar con Apple
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleOAuth('linkedin_oidc')}
              disabled={!!oauthLoading}
              className={cn(
                "w-full h-11 rounded-lg border font-medium flex items-center justify-center gap-3 transition-all",
                "hover:border-[#7c3aed]/50 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              style={{ 
                backgroundColor: 'transparent',
                borderColor: '#262626',
                color: '#e4e4e7'
              }}
            >
              {oauthLoading === 'linkedin_oidc' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0A66C2">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  Continuar con LinkedIn
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: '#262626' }} />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4" style={{ backgroundColor: '#141414', color: '#71717a' }}>
                o continúa con email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.general && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg text-sm"
                style={{ 
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#f87171'
                }}
              >
                {errors.general}
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg text-sm"
                style={{ 
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  color: '#4ade80'
                }}
              >
                {success}
              </motion.div>
            )}

            {/* Email field */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white">Email</label>
              <div className="relative">
                <Mail 
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: '#71717a' }}
                />
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errors.email) setErrors({ ...errors, email: undefined })
                  }}
                  className={cn(
                    "w-full h-11 pl-10 pr-4 rounded-lg border text-white placeholder:text-zinc-500",
                    "focus:outline-none focus:ring-2 transition-all",
                    errors.email ? "border-red-500/50 focus:ring-red-500/20" : "focus:ring-[#7c3aed]/20"
                  )}
                  style={{ 
                    backgroundColor: '#1a1a1a',
                    borderColor: errors.email ? '#ef4444' : '#262626'
                  }}
                />
              </div>
              <AnimatePresence>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs"
                    style={{ color: '#f87171' }}
                  >
                    {errors.email}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white">Contraseña</label>
              <div className="relative">
                <Lock 
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: '#71717a' }}
                />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password) setErrors({ ...errors, password: undefined })
                  }}
                  className={cn(
                    "w-full h-11 pl-10 pr-4 rounded-lg border text-white placeholder:text-zinc-500",
                    "focus:outline-none focus:ring-2 transition-all",
                    errors.password ? "border-red-500/50 focus:ring-red-500/20" : "focus:ring-[#7c3aed]/20"
                  )}
                  style={{ 
                    backgroundColor: '#1a1a1a',
                    borderColor: errors.password ? '#ef4444' : '#262626'
                  }}
                />
              </div>
              <AnimatePresence>
                {errors.password && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs"
                    style={{ color: '#f87171' }}
                  >
                    {errors.password}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Submit button */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={cn(
                "w-full h-11 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              style={{ 
                background: 'linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)'
              }}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'
              )}
            </motion.button>
          </form>

          {/* Switch mode */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={switchMode}
              className="text-sm transition-colors"
              style={{ color: '#71717a' }}
            >
              {mode === 'login' ? (
                <>
                  ¿No tienes cuenta?{' '}
                  <span className="font-medium hover:underline" style={{ color: '#7c3aed' }}>
                    Regístrate
                  </span>
                </>
              ) : (
                <>
                  ¿Ya tienes cuenta?{' '}
                  <span className="font-medium hover:underline" style={{ color: '#7c3aed' }}>
                    Inicia sesión
                  </span>
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: '#52525b' }}>
          Al continuar, aceptas los{' '}
          <a href="#" className="underline hover:text-white transition-colors">Términos de servicio</a>
          {' '}y la{' '}
          <a href="#" className="underline hover:text-white transition-colors">Política de privacidad</a>
        </p>
      </div>
    </div>
  )
}
