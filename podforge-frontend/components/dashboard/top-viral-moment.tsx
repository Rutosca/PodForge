"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, Sparkles, Flame, Clock, TrendingUp, RefreshCw, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Clip, CopyResult, clipTypeLabels } from "@/lib/mock-data"
import { generateCopy } from "@/lib/api"
import { formatDuration } from "@/lib/youtube-utils"

function PlatformFitBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-8">{label}</span>
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-10 text-right">{value}%</span>
    </div>
  )
}

interface TopViralMomentProps {
  clip: Clip
  transcripcion: string
  resumenContexto: string
  onPreview: (clip: Clip) => void
}

export function TopViralMoment({ clip, transcripcion, resumenContexto, onPreview }: TopViralMomentProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [regenerateCount, setRegenerateCount] = useState(0)
  const [copyError, setCopyError] = useState<string | null>(null)
  
  const typeConfig = clipTypeLabels[clip.type] || { label: clip.type, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }
  const maxRegenerations = 3

  const handleGenerateCopy = async () => {
    setIsGenerating(true)
    setIsExpanded(true)
    setCopyError(null)
    
    try {
      const result = await generateCopy(clip, transcripcion, resumenContexto)
      setCopyResult(result)
    } catch (err: any) {
      setCopyError(err.message || 'Error al generar copy')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRegenerate = async () => {
    if (regenerateCount >= maxRegenerations) return
    
    setIsGenerating(true)
    setCopyError(null)
    setRegenerateCount(prev => prev + 1)
    
    try {
      const result = await generateCopy(clip, transcripcion, resumenContexto)
      setCopyResult(result)
    } catch (err: any) {
      setCopyError(err.message || 'Error al regenerar')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-6 md:p-8"
    >
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-accent/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        {/* Score section */}
        <div className="flex flex-col items-center gap-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2, stiffness: 200 }}
            className="relative"
          >
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center border-glow">
              <div className="text-center">
                <Flame className="w-6 h-6 mx-auto mb-1 text-white/80" />
                <span className="text-3xl md:text-5xl font-bold text-white">{clip.viral_score}</span>
              </div>
            </div>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-2 -right-2 bg-yellow-500 text-yellow-950 text-xs font-bold px-2 py-1 rounded-full"
            >
              TOP
            </motion.div>
          </motion.div>
          <span className="text-sm text-muted-foreground font-medium">Viral Score</span>
        </div>

        {/* Content section */}
        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`${typeConfig.color} border`}>
              {typeConfig.label}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(clip.duration_seconds)}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <TrendingUp className="w-3 h-3" />
              Hook: {clip.intensidad_hook}%
            </Badge>
          </div>

          <h3 className="text-lg md:text-xl font-semibold text-foreground">
            {clip.topic}
          </h3>

          <blockquote className="border-l-4 border-primary pl-4 py-2 bg-primary/5 rounded-r-lg">
            <p className="text-base md:text-lg italic text-foreground/90 text-pretty">
              &ldquo;{clip.frase_clave}&rdquo;
            </p>
          </blockquote>

          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="font-mono bg-secondary/50 px-2 py-1 rounded">
              {clip.start}
            </span>
            <span className="text-muted-foreground/50">-</span>
            <span className="font-mono bg-secondary/50 px-2 py-1 rounded">
              {clip.end}
            </span>
          </div>

          {/* Platform Fit */}
          <div className="bg-secondary/30 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">Platform Fit</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PlatformFitBar label="TikTok" value={clip.platform_fit.tiktok} />
              <PlatformFitBar label="Instagram" value={clip.platform_fit.instagram} />
              <PlatformFitBar label="YT Shorts" value={clip.platform_fit.youtube_shorts} />
              <PlatformFitBar label="Twitter/X" value={clip.platform_fit.twitter} />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              onClick={() => onPreview(clip)}
              variant="outline"
              className="gap-2 border-primary/30 hover:border-primary hover:bg-primary/10"
            >
              <Play className="w-4 h-4" />
              Ver clip
            </Button>
            <Button
              onClick={handleGenerateCopy}
              disabled={isGenerating}
              className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white border-0"
            >
              <Sparkles className="w-4 h-4" />
              {copyResult ? 'Regenerar Copy completo' : 'Generar Copy completo'}
            </Button>
          </div>

          {/* Inline Copy Expansion */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="pt-4 mt-4 border-t border-primary/20 space-y-4">
                  {isGenerating ? (
                    <div className="space-y-4">
                      <div>
                        <Skeleton className="h-4 w-16 mb-2" />
                        <Skeleton className="h-6 w-3/4" />
                      </div>
                      <div>
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-5 w-full mb-1.5" />
                        <Skeleton className="h-5 w-full mb-1.5" />
                        <Skeleton className="h-5 w-5/6" />
                      </div>
                      <div>
                        <Skeleton className="h-4 w-16 mb-2" />
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-4/5" />
                      </div>
                    </div>
                  ) : copyResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      {/* Title */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Titulo viral</p>
                        <p className="text-lg font-semibold text-primary">
                          {copyResult.titulo}
                        </p>
                      </div>

                      {/* Hooks */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Hooks sugeridos</p>
                        <ol className="space-y-2">
                          {copyResult.hooks.map((hook, i) => (
                            <li key={i} className="flex gap-3 text-sm">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs">
                                {i + 1}
                              </span>
                              <span className="text-foreground/90 leading-relaxed">{hook}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* Caption */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Caption</p>
                        <p className="text-sm text-foreground/80 leading-relaxed bg-secondary/30 p-3 rounded-lg">
                          {copyResult.caption}
                        </p>
                      </div>

                      {/* Format & Regenerate */}
                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <Badge variant="outline" className="gap-1">
                          {copyResult.formato_recomendado}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRegenerate}
                          disabled={regenerateCount >= maxRegenerations || isGenerating}
                          className="gap-1.5 text-xs border-primary/30 hover:border-primary"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Regenerar ({maxRegenerations - regenerateCount} restantes)
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Collapse toggle */}
                  {copyResult && !isGenerating && (
                    <button
                      onClick={() => setIsExpanded(false)}
                      className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pt-2"
                    >
                      <ChevronUp className="w-4 h-4" />
                      Ocultar copy
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
