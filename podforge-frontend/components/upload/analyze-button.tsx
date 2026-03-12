'use client'

import { motion } from 'framer-motion'
import { Sparkles, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AnalyzeButtonProps {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}

export function AnalyzeButton({ onClick, disabled, loading }: AnalyzeButtonProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        className="relative"
      >
        {/* Glow effect */}
        <div className={cn(
          "absolute inset-0 rounded-xl blur-xl transition-opacity duration-500",
          "bg-gradient-to-r from-primary to-accent",
          disabled ? "opacity-0" : "opacity-40"
        )} />
        
        <Button
          onClick={onClick}
          disabled={disabled || loading}
          size="lg"
          className={cn(
            "relative h-14 px-10 text-lg font-semibold",
            "bg-gradient-to-r from-primary to-accent",
            "hover:from-primary/90 hover:to-accent/90",
            "border-0 text-white shadow-2xl",
            "transition-all duration-300",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            !disabled && "hover:shadow-primary/30 hover:shadow-2xl"
          )}
        >
          {loading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles className="w-5 h-5 mr-2" />
            </motion.div>
          ) : (
            <Sparkles className="w-5 h-5 mr-2" />
          )}
          {loading ? 'Iniciando análisis...' : 'Analizar podcast'}
        </Button>
      </motion.div>

      {/* Credit cost indicator */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Zap className="w-3.5 h-3.5 text-amber-400" />
        <span>1 crédito por análisis</span>
      </motion.div>
    </div>
  )
}
