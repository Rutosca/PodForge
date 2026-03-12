'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Youtube, Link2, Check, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface URLInputProps {
  value: string
  onChange: (value: string) => void
}

function isValidYouTubeUrl(url: string): boolean {
  const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/
  return pattern.test(url)
}

export function URLInput({ value, onChange }: URLInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  
  const isValid = value.length === 0 || isValidYouTubeUrl(value)
  const hasValidUrl = value.length > 0 && isValid

  return (
    <div className="relative">
      <motion.div
        animate={{
          boxShadow: isFocused 
            ? '0 0 0 2px oklch(0.7 0.25 320 / 0.3)' 
            : '0 0 0 0px transparent'
        }}
        className={cn(
          "relative flex items-center rounded-xl overflow-hidden",
          "bg-card border transition-colors duration-200",
          hasValidUrl 
            ? "border-emerald-500/50" 
            : !isValid 
              ? "border-destructive/50"
              : isFocused 
                ? "border-primary/50" 
                : "border-border"
        )}
      >
        {/* Icon */}
        <div className={cn(
          "flex items-center justify-center w-12 h-12 shrink-0",
          "border-r border-border"
        )}>
          {value.includes('youtu') ? (
            <Youtube className={cn(
              "w-5 h-5",
              hasValidUrl ? "text-red-500" : "text-muted-foreground"
            )} />
          ) : (
            <Link2 className="w-5 h-5 text-muted-foreground" />
          )}
        </div>

        {/* Input */}
        <Input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="https://youtube.com/watch?v=..."
          className={cn(
            "border-0 bg-transparent h-12 text-base",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
            "placeholder:text-muted-foreground/50"
          )}
        />

        {/* Validation indicator */}
        <div className="pr-4">
          {value.length > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center",
                hasValidUrl 
                  ? "bg-emerald-500/20 text-emerald-500" 
                  : "bg-destructive/20 text-destructive"
              )}
            >
              {hasValidUrl ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Error message */}
      {!isValid && value.length > 0 && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-destructive mt-2 pl-1"
        >
          Por favor, introduce una URL válida de YouTube
        </motion.p>
      )}
    </div>
  )
}
