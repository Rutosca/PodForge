'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Loader2, ArrowLeft, CheckCircle2, Sparkles, Play, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
  const [success, setSuccess] = useState<boolean>(false)

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
          setSuccess(true)
        }
      }
    } catch {
      setErrors({ general: 'Ocurrió un error inesperado' })
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: 'google') => {
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
    setSuccess(false)
  }

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left Panel - Visual/Brand (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-zinc-950 flex-col justify-between p-12">
        {/* Dynamic Gradients */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 -left-1/4 w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/30 via-background to-background blur-[100px] opacity-70" />
          <div className="absolute -bottom-1/2 -right-1/4 w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/20 via-background/5 to-transparent blur-[100px] opacity-60" />
          
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10" />
        </div>

        {/* Top Logo */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Play className="w-5 h-5 text-white fill-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">
              PodForge
            </span>
          </Link>
        </div>

        {/* Center Content */}
        <div className="relative z-10 max-w-lg mt-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-zinc-300">Inteligencia Artificial para Creadores</span>
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
              Transforma tu contenido largo en <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">clips virales</span>
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed mb-10">
              Sube tus videos, y nuestra IA encontrará los momentos más interesantes, creará clips optimizados para redes sociales y generará subtítulos dinámicos automáticamente.
            </p>
          </motion.div>

          {/* Floating Feature Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex items-start gap-4 relative z-10">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Seguridad y Privacidad</h3>
                <p className="text-sm text-zinc-400">Tus datos y contenidos están encriptados y protegidos con los más altos estándares de seguridad de la industria.</p>
              </div>
            </div>
          </motion.div>
        </div>
        
        {/* Footer */}
        <div className="relative z-10 text-sm text-zinc-500 font-medium">
          © {new Date().getFullYear()} PodForge Inc.
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
        {/* Mobile Logo (only visible on mobile) */}
        <div className="absolute top-6 left-6 lg:hidden">
          <Link href="/" className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white" />
          </Link>
        </div>

        <Link 
          href="/"
          className="absolute top-6 right-6 lg:right-12 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium px-4 py-2 rounded-full hover:bg-secondary/80"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>

        <div className="w-full max-w-[420px]">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4 }}
                className="text-center space-y-6"
              >
                <div className="w-24 h-24 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-8 relative">
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
                  <Mail className="w-10 h-10 text-emerald-500" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight">Revisa tu correo</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Hemos enviado un enlace mágico a <span className="text-foreground font-medium">{email}</span>. Haz clic en él para confirmar tu cuenta y comenzar a crear.
                </p>
                <div className="pt-6">
                  <Button 
                    variant="outline" 
                    className="w-full h-12 text-base font-medium rounded-xl"
                    onClick={() => {
                      setSuccess(false)
                      setMode('login')
                    }}
                  >
                    Volver al inicio de sesión
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
              >
                <div className="mb-10">
                  <h2 className="text-3xl font-bold tracking-tight mb-2">
                    {mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
                  </h2>
                  <p className="text-muted-foreground">
                    {mode === 'login' 
                      ? 'Ingresa tus credenciales para acceder a tu panel.' 
                      : 'Únete hoy y empieza a extraer clips mágicamente.'}
                  </p>
                </div>

                <div className="space-y-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOAuth('google')}
                    disabled={!!oauthLoading}
                    className="w-full h-12 rounded-xl border-border/60 bg-secondary/30 hover:bg-secondary/80 flex items-center justify-center gap-3 transition-all font-medium text-base shadow-sm"
                  >
                    {oauthLoading === 'google' ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
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
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/60" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-4 text-muted-foreground font-medium">O continúa con email</span>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <AnimatePresence>
                      {errors.general && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, y: -10 }}
                          animate={{ opacity: 1, height: 'auto', y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -10 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-500 font-medium leading-relaxed">{errors.general}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                      <div className="relative group">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="tu@email.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value)
                            if (errors.email) setErrors({ ...errors, email: undefined })
                          }}
                          className={cn(
                            "w-full h-12 pl-11 pr-4 rounded-xl border-border/60 bg-secondary/20 hover:bg-secondary/40 focus:bg-background text-base transition-all",
                            errors.email && "border-red-500/50 focus-visible:ring-red-500/30"
                          )}
                        />
                      </div>
                      {errors.email && (
                        <p className="text-sm text-red-500 font-medium pl-1">{errors.email}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
                        {mode === 'login' && (
                          <Link href="#" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                            ¿Olvidaste tu contraseña?
                          </Link>
                        )}
                      </div>
                      <div className="relative group">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value)
                            if (errors.password) setErrors({ ...errors, password: undefined })
                          }}
                          className={cn(
                            "w-full h-12 pl-11 pr-4 rounded-xl border-border/60 bg-secondary/20 hover:bg-secondary/40 focus:bg-background text-base transition-all",
                            errors.password && "border-red-500/50 focus-visible:ring-red-500/30"
                          )}
                        />
                      </div>
                      {errors.password && (
                        <p className="text-sm text-red-500 font-medium pl-1">{errors.password}</p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className={cn(
                        "w-full h-12 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all mt-2",
                        "bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg shadow-primary/25",
                        "disabled:opacity-70 disabled:cursor-not-allowed"
                      )}
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        mode === 'login' ? 'Iniciar sesión' : 'Crear mi cuenta'
                      )}
                    </Button>
                  </form>

                  <div className="text-center pt-4">
                    <button
                      type="button"
                      onClick={switchMode}
                      className="text-sm text-muted-foreground font-medium hover:text-foreground transition-colors"
                    >
                      {mode === 'login' ? (
                        <>
                          ¿No tienes cuenta? <span className="text-primary hover:underline">Regístrate gratis</span>
                        </>
                      ) : (
                        <>
                          ¿Ya tienes cuenta? <span className="text-primary hover:underline">Inicia sesión</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Al continuar, aceptas nuestros{' '}
            <Link href="#" className="underline hover:text-foreground transition-colors">Términos de servicio</Link>
            {' '}y la{' '}
            <Link href="#" className="underline hover:text-foreground transition-colors">Política de privacidad</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
