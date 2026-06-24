'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Lock, Loader2, CheckCircle2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth/auth-provider'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) {
        setError(error.includes('Invalid login credentials') 
          ? 'Credenciales inválidas. Verifica tu email y contraseña.' 
          : error)
      } else {
        onClose()
      }
    } else {
      const { error } = await signUp(email, password)
      if (error) {
        setError(error.includes('already registered') 
          ? 'Este email ya está registrado' 
          : error)
      } else {
        setSuccess(true)
      }
    }
    setLoading(false)
  }

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setError(null)
    setSuccess(false)
  }

  const handleClose = () => {
    onClose()
    // Give time for exit animation before resetting
    setTimeout(resetForm, 300)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={cn(
                "w-full max-w-md rounded-2xl md:rounded-3xl pointer-events-auto relative overflow-hidden",
                "bg-background border border-border/50 shadow-2xl shadow-black/50"
              )}
            >
              {/* Top gradients for premium feel */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="absolute -top-32 -left-32 w-64 h-64 bg-primary/20 rounded-full blur-[80px]" />
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-accent/20 rounded-full blur-[80px]" />

              {/* Close Button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors z-20"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>

              <div className="p-6 sm:p-8 relative z-10">
                <AnimatePresence mode="wait">
                  {success ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.4 }}
                      className="text-center py-6"
                    >
                      <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 relative">
                        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
                        <Mail className="w-8 h-8 text-emerald-500" />
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight mb-3">Revisa tu correo</h2>
                      <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                        Hemos enviado un enlace mágico a <span className="text-foreground font-medium">{email}</span>. Haz clic para confirmar tu cuenta.
                      </p>
                      <Button 
                        variant="outline" 
                        className="w-full h-11 text-sm font-medium rounded-xl"
                        onClick={handleClose}
                      >
                        Entendido
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      {/* Header */}
                      <div className="text-center mb-8">
                        <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
                          <Play className="w-6 h-6 text-white fill-white" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight mb-1.5">
                          {mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {mode === 'login'
                            ? 'Accede a tu cuenta de PodForge'
                            : 'Regístrate para más análisis gratuitos'}
                        </p>
                      </div>

                      {/* Form */}
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <AnimatePresence>
                          {error && (
                            <motion.div
                              initial={{ opacity: 0, height: 0, y: -10 }}
                              animate={{ opacity: 1, height: 'auto', y: 0 }}
                              exit={{ opacity: 0, height: 0, y: -10 }}
                              className="overflow-hidden"
                            >
                              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 mb-2">
                                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-red-500 font-medium leading-relaxed">{error}</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="space-y-2">
                          <Label htmlFor="modal-email" className="text-sm font-medium">Email</Label>
                          <div className="relative group">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                              id="modal-email"
                              type="email"
                              placeholder="tu@email.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                              className="w-full h-11 pl-10 pr-4 rounded-xl border-border/60 bg-secondary/20 hover:bg-secondary/40 focus:bg-background text-sm transition-all"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="modal-password" className="text-sm font-medium">Contraseña</Label>
                          <div className="relative group">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                              id="modal-password"
                              type="password"
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                              minLength={6}
                              className="w-full h-11 pl-10 pr-4 rounded-xl border-border/60 bg-secondary/20 hover:bg-secondary/40 focus:bg-background text-sm transition-all"
                            />
                          </div>
                        </div>

                        <Button
                          type="submit"
                          disabled={loading}
                          className={cn(
                            "w-full h-11 mt-2 rounded-xl font-semibold text-sm transition-all",
                            "bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg shadow-primary/20",
                            "disabled:opacity-70 disabled:cursor-not-allowed"
                          )}
                        >
                          {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : mode === 'login' ? (
                            'Iniciar sesión'
                          ) : (
                            'Crear cuenta'
                          )}
                        </Button>

                        <div className="text-center pt-3 border-t border-border/50 mt-6">
                          <button
                            type="button"
                            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}
                            className="text-sm text-muted-foreground font-medium hover:text-foreground transition-colors"
                          >
                            {mode === 'login' ? (
                              <>¿No tienes cuenta? <span className="text-primary hover:underline">Regístrate</span></>
                            ) : (
                              <>¿Ya tienes cuenta? <span className="text-primary hover:underline">Inicia sesión</span></>
                            )}
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
