"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, Copy, Sparkles, RefreshCw, ChevronDown, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Clip, CopyResult, clipTypeLabels } from "@/lib/mock-data"
import { generateCopy } from "@/lib/api"
import { formatDuration } from "@/lib/youtube-utils"

interface ClipCardProps {
  clip: Clip
  index: number
  transcripcion: string
  resumenContexto: string
  onPreview: (clip: Clip) => void
}

function PlatformFitBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-6">{label}</span>
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-8">{value}%</span>
    </div>
  )
}

export function ClipCard({ clip, index, transcripcion, resumenContexto, onPreview }: ClipCardProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [regenerateCount, setRegenerateCount] = useState(0)
  const [copiedTimestamp, setCopiedTimestamp] = useState(false)
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

  const handleCopyTimestamp = () => {
    navigator.clipboard.writeText(`${clip.start} - ${clip.end}`)
    setCopiedTimestamp(true)
    setTimeout(() => setCopiedTimestamp(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
    >
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Clip #{index + 1}</span>
            <Badge className={`${typeConfig.color} border text-xs`}>
              {typeConfig.label}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Score</span>
            <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${clip.viral_score}%` }}
                transition={{ duration: 0.8, delay: 0.2 + index * 0.1 }}
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
              />
            </div>
            <span className="text-sm font-bold text-primary">{clip.viral_score}</span>
          </div>
        </div>

        {/* Timestamps */}
        <div className="flex items-center gap-2 text-sm mb-3">
          <span className="font-mono bg-secondary/70 px-2 py-0.5 rounded text-xs">
            {clip.start}
          </span>
          <span className="text-muted-foreground/50">→</span>
          <span className="font-mono bg-secondary/70 px-2 py-0.5 rounded text-xs">
            {clip.end}
          </span>
          <Badge variant="outline" className="text-xs ml-auto">
            {formatDuration(clip.duration_seconds)}
          </Badge>
        </div>

        {/* Topic */}
        <h4 className="font-semibold text-foreground mb-2">{clip.topic}</h4>

        {/* Key phrase */}
        <blockquote className="border-l-2 border-primary pl-3 py-1 text-sm italic text-foreground/80">
          &ldquo;{clip.frase_clave}&rdquo;
        </blockquote>
      </div>

      {/* Platform fit */}
      <div className="px-4 py-3 bg-secondary/20 border-b border-border/50">
        <p className="text-xs text-muted-foreground mb-2 font-medium">Platform Fit</p>
        <div className="grid grid-cols-2 gap-2">
          <PlatformFitBar label="TT" value={clip.platform_fit.tiktok} />
          <PlatformFitBar label="IG" value={clip.platform_fit.instagram} />
          <PlatformFitBar label="YT" value={clip.platform_fit.youtube_shorts} />
          <PlatformFitBar label="X" value={clip.platform_fit.twitter} />
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 text-xs"
            onClick={() => onPreview(clip)}
          >
            <Play className="w-3 h-3" />
            Ver clip
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleCopyTimestamp}
          >
            {copiedTimestamp ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            {copiedTimestamp ? 'Copiado' : 'Timestamps'}
          </Button>
        </div>

        <Button
          onClick={handleGenerateCopy}
          disabled={isGenerating}
          className="w-full gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white border-0 text-sm"
        >
          <Sparkles className="w-4 h-4" />
          Generar Copy completo
        </Button>

        {/* Expandable copy section */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-border/50 space-y-3">
                {isGenerating ? (
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </div>
                ) : copyResult && (
                  <div className="space-y-3">
                    {/* Title */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Titulo</p>
                      <p className="text-sm font-semibold text-primary">
                        {copyResult.titulo}
                      </p>
                    </div>

                    {/* Hooks */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Hooks sugeridos</p>
                      <ol className="space-y-1.5">
                        {copyResult.hooks.map((hook, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <span className="text-primary font-bold">{i + 1}.</span>
                            <span className="text-foreground/80">{hook}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Caption */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Caption</p>
                      <p className="text-sm text-foreground/80">{copyResult.caption}</p>
                    </div>

                    {/* Format badge */}
                    <Badge variant="outline" className="text-xs">
                      {copyResult.formato_recomendado}
                    </Badge>

                    {/* Regenerate button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerate}
                      disabled={regenerateCount >= maxRegenerations || isGenerating}
                      className="w-full gap-1.5 text-xs"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Regenerar ({maxRegenerations - regenerateCount} restantes)
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expand/collapse toggle */}
        {copyResult && !isGenerating && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            {isExpanded ? 'Ocultar copy' : 'Ver copy generado'}
          </button>
        )}
      </div>
    </motion.div>
  )
}
