'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, Play, Mic2, AlertCircle } from 'lucide-react'
import { URLInput } from '@/components/upload/url-input'
import { UploadZone } from '@/components/upload/upload-zone'
import { AnalyzeButton } from '@/components/upload/analyze-button'
import { cn } from '@/lib/utils'

interface InputScreenProps {
  onStartAnalysis: (url: string, file: File | null) => void
  error?: string | null
}

export function InputScreen({ onStartAnalysis, error }: InputScreenProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [inputMethod, setInputMethod] = useState<'url' | 'file'>('url')

  const isValidYouTubeUrl = (url: string) => {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/
    return pattern.test(url)
  }

  const canAnalyze = ((inputMethod === 'url' && isValidYouTubeUrl(url)) || (inputMethod === 'file' && file !== null)) && !isSubmitting

  const handleAnalyze = async () => {
    setIsSubmitting(true)
    await onStartAnalysis(
      inputMethod === 'url' ? url : '',
      inputMethod === 'file' ? file : null
    )
    setIsSubmitting(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12"
    >
      {/* Hero Section */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        {/* Decorative icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mb-6 relative"
        >
          <Mic2 className="w-8 h-8 text-primary" />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-accent opacity-20 blur-xl" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 text-balance"
        >
          Encuentra los{' '}
          <span className="text-gradient">momentos virales</span>
          {' '}de tu podcast
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg text-muted-foreground max-w-lg mx-auto text-pretty"
        >
          Nuestra IA analiza tu contenido, detecta clips de alto impacto y genera copy listo para redes sociales.
        </motion.p>
      </div>

      {/* Input Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className={cn(
          "w-full max-w-xl p-6 sm:p-8 rounded-2xl",
          "bg-card/80 backdrop-blur-sm",
          "border border-border",
          "shadow-xl shadow-black/20"
        )}
      >
        {/* Input Method Toggle */}
        <div className="flex items-center gap-2 p-1 bg-secondary/50 rounded-lg mb-6">
          <button
            onClick={() => setInputMethod('url')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all",
              inputMethod === 'url'
                ? "bg-card text-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Play className="w-4 h-4" />
            URL de YouTube
          </button>
          <button
            onClick={() => setInputMethod('file')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all",
              inputMethod === 'file'
                ? "bg-card text-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Mic2 className="w-4 h-4" />
            Subir archivo
          </button>
        </div>

        {/* Input Area */}
        <div className="mb-8">
          {inputMethod === 'url' ? (
            <URLInput value={url} onChange={setUrl} />
          ) : (
            <UploadZone selectedFile={file} onFileSelect={setFile} />
          )}
        </div>

        {/* Analyze Button */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <AnalyzeButton 
          onClick={handleAnalyze} 
          disabled={!canAnalyze}
        />
      </motion.div>

      {/* Features hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-sm text-muted-foreground"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Análisis en minutos</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          <span>Clips listos para TikTok & Reels</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          <span>Copy generado por IA</span>
        </div>
      </motion.div>
    </motion.div>
  )
}
