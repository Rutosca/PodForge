'use client'

import { motion } from 'framer-motion'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProcessingStepProps {
  label: string
  status: 'pending' | 'active' | 'completed'
  index: number
}

export function ProcessingStep({ label, status, index }: ProcessingStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "flex items-center gap-4 py-4 px-5 rounded-xl",
        "transition-all duration-300",
        status === 'active' && "bg-primary/5 border border-primary/20",
        status === 'completed' && "bg-emerald-500/5",
        status === 'pending' && "opacity-50"
      )}
    >
      {/* Status Icon */}
      <div className="relative shrink-0">
        {status === 'completed' ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center"
          >
            <Check className="w-4 h-4 text-emerald-500" />
          </motion.div>
        ) : status === 'active' ? (
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary flex items-center justify-center"
            />
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-md" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full border-2 border-border bg-secondary/50" />
        )}
      </div>

      {/* Label */}
      <span className={cn(
        "text-base font-medium transition-colors",
        status === 'completed' && "text-emerald-400",
        status === 'active' && "text-foreground",
        status === 'pending' && "text-muted-foreground"
      )}>
        {label}
        {status === 'active' && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="ml-1"
          >
            ...
          </motion.span>
        )}
      </span>
    </motion.div>
  )
}
