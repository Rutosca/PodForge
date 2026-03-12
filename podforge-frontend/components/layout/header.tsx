'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, ChevronRight, User, LogOut, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth/auth-provider'
import { AuthModal } from '@/components/auth/auth-modal'

interface HeaderProps {
  currentView: 'input' | 'processing' | 'results'
  sidebarCollapsed: boolean
}

const viewLabels = {
  input: 'Nuevo análisis',
  processing: 'Procesando',
  results: 'Resultados',
}

export function Header({ currentView, sidebarCollapsed }: HeaderProps) {
  const { user, credits, signOut } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)

  const { remaining, plan, unlimited } = credits

  // Iniciales del usuario
  const initials = user?.email
    ? user.email.split('@')[0].slice(0, 2).toUpperCase()
    : 'U'

  return (
    <>
      <header className={cn(
        "h-16 border-b border-border bg-card/50 backdrop-blur-sm",
        "flex items-center justify-between px-4 lg:px-6",
        "fixed top-0 right-0 z-20",
        sidebarCollapsed ? "lg:left-[72px]" : "lg:left-[280px]",
        "left-0 transition-all duration-200"
      )}>
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm ml-12 lg:ml-0">
          <span className="text-muted-foreground">PodForge</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
          <motion.span 
            key={currentView}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-foreground font-medium"
          >
            {viewLabels[currentView]}
          </motion.span>
        </nav>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* Credits Display */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full",
              "bg-secondary/80 border border-border",
              plan === 'PRO' && "border-primary/30 bg-primary/10"
            )}
          >
            <Zap className={cn(
              "w-4 h-4",
              plan === 'PRO' ? "text-primary" : "text-amber-400"
            )} />
            <span className="text-sm font-medium">
              {unlimited ? (
                <span className="text-gradient">PRO &infin;</span>
              ) : (
                <>
                  <span className="text-foreground">{remaining}</span>
                  <span className="text-muted-foreground hidden sm:inline"> análisis</span>
                  <span className="text-muted-foreground/70 text-xs ml-1">({plan})</span>
                </>
              )}
            </span>
          </motion.div>

          {/* User Button */}
          {user ? (
            // Logged in: show dropdown
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full hover:bg-secondary"
                >
                  <Avatar className="w-8 h-8 border border-primary/30">
                    <AvatarFallback className="bg-gradient-to-br from-primary/30 to-accent/30 text-foreground text-sm font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                  <p className="text-xs text-muted-foreground">{plan === 'PRO' ? 'Plan Pro' : 'Plan Gratuito'}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  {remaining} análisis restantes
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="gap-2 text-red-400 focus:text-red-400">
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // Not logged in: show login button
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAuthModalOpen(true)}
              className="gap-2 border-primary/30 hover:border-primary hover:bg-primary/10"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Iniciar sesión</span>
            </Button>
          )}
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  )
}
