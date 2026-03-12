"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Lightbulb, Twitter, Linkedin, Video, LayoutGrid,
  ChevronDown, Copy, Check, Sparkles, TrendingUp,
  Zap, Brain, AlertTriangle, BarChart2, Eye, Heart, MessageSquare
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ViralIdea, IdeaTipo } from "@/lib/api"

// ── Configuración visual por tipo de idea ────────────────────

const TIPO_CONFIG: Record<IdeaTipo, { label: string; icon: React.ComponentType<any>; color: string; bg: string }> = {
  contrarian:          { label: "Contradicción",    icon: Zap,           color: "text-fuchsia-400",  bg: "bg-fuchsia-500/10 border-fuchsia-500/30" },
  mental_framework:    { label: "Marco mental",     icon: Brain,         color: "text-violet-400",   bg: "bg-violet-500/10 border-violet-500/30" },
  uncomfortable_truth: { label: "Verdad incómoda",  icon: AlertTriangle, color: "text-amber-400",    bg: "bg-amber-500/10 border-amber-500/30" },
  data_shock:          { label: "Dato sorprendente",icon: BarChart2,     color: "text-cyan-400",     bg: "bg-cyan-500/10 border-cyan-500/30" },
  prediction:          { label: "Predicción",       icon: Eye,           color: "text-emerald-400",  bg: "bg-emerald-500/10 border-emerald-500/30" },
  confession:          { label: "Confesión",        icon: Heart,         color: "text-rose-400",     bg: "bg-rose-500/10 border-rose-500/30" },
  system_critique:     { label: "Crítica al sistema",icon: MessageSquare, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
}

const FORMATO_CONFIG = {
  tweet:      { label: "Tweet",    icon: Twitter,     color: "text-sky-400",     hint: "240 chars" },
  linkedin:   { label: "LinkedIn", icon: Linkedin,    color: "text-blue-400",    hint: "3 frases" },
  hook_video: { label: "Hook vídeo",icon: Video,      color: "text-fuchsia-400", hint: "15 palabras" },
  carrusel:   { label: "Carrusel", icon: LayoutGrid,  color: "text-violet-400",  hint: "portada" },
} as const

// ── Sub-componente: un formato de una idea ───────────────────

function FormatBlock({
  formato,
  contenido,
}: {
  formato: keyof typeof FORMATO_CONFIG
  contenido: string
}) {
  const [copied, setCopied] = useState(false)
  const config = FORMATO_CONFIG[formato]
  const Icon = config.icon

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contenido)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  if (!contenido) return null

  return (
    <div className="group relative rounded-lg border border-border/50 bg-secondary/30 p-3 hover:border-border transition-colors">
      {/* Header del formato */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-3.5 h-3.5", config.color)} />
          <span className="text-xs font-medium text-muted-foreground">{config.label}</span>
          <span className="text-xs text-muted-foreground/50">· {config.hint}</span>
        </div>
        <button
          onClick={handleCopy}
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-all p-1 rounded",
            "hover:bg-primary/10 text-muted-foreground hover:text-primary",
            copied && "opacity-100 text-emerald-400"
          )}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Contenido */}
      <p className="text-sm text-foreground/80 leading-relaxed">
        {contenido}
      </p>
    </div>
  )
}

// ── Sub-componente: tarjeta de una idea ──────────────────────

function IdeaCard({ idea, index }: { idea: ViralIdea; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const tipoConfig = TIPO_CONFIG[idea.tipo] ?? TIPO_CONFIG.contrarian
  const TipoIcon = tipoConfig.icon

  const scoreColor =
    idea.potencial_viral >= 80 ? "text-fuchsia-400" :
    idea.potencial_viral >= 65 ? "text-violet-400" :
    "text-muted-foreground"

  const formatos = idea.formatos
  const formatosActivos = Object.entries(formatos).filter(([, v]) => v) as [keyof typeof FORMATO_CONFIG, string][]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className={cn(
        "rounded-xl border bg-card overflow-hidden",
        expanded ? "border-border" : "border-border/60 hover:border-border"
      )}
    >
      {/* Cabecera — siempre visible */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left p-4 flex items-start gap-4"
      >
        {/* Número + score */}
        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
          <span className="text-xs text-muted-foreground/50 font-mono">#{index + 1}</span>
          <div className={cn("text-sm font-bold tabular-nums", scoreColor)}>
            {idea.potencial_viral}
          </div>
          <TrendingUp className={cn("w-3 h-3", scoreColor)} />
        </div>

        {/* Idea central */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <Badge
              variant="outline"
              className={cn("text-xs px-2 py-0.5 border", tipoConfig.bg, tipoConfig.color)}
            >
              <TipoIcon className="w-3 h-3 mr-1" />
              {tipoConfig.label}
            </Badge>
            <span className="text-xs text-muted-foreground/60">{formatosActivos.length} formatos</span>
          </div>
          <p className="text-sm font-medium text-foreground leading-snug">
            {idea.idea_central}
          </p>
          {idea.angulo_conflicto && !expanded && (
            <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-1">
              {idea.angulo_conflicto}
            </p>
          )}
        </div>

        {/* Chevron */}
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
      </button>

      {/* Contenido expandido */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-3">
              {/* Ángulo de conflicto */}
              {idea.angulo_conflicto && (
                <div className="flex gap-2 bg-secondary/40 rounded-lg p-3">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-amber-400 mb-0.5">Ángulo de conflicto</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {idea.angulo_conflicto}
                    </p>
                  </div>
                </div>
              )}

              {/* Formatos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {formatosActivos.map(([key, value]) => (
                  <FormatBlock key={key} formato={key} contenido={value} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Componente principal ─────────────────────────────────────

interface IdeasPanelProps {
  transcripcion: string
  resumenContexto?: string
  canUseIdeas?: boolean        // false si el plan no lo permite
}

export function IdeasPanel({ transcripcion, resumenContexto = "", canUseIdeas = true }: IdeasPanelProps) {
  const [ideas, setIdeas] = useState<ViralIdea[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  const handleExtract = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { extractIdeas } = await import("@/lib/api")
      const result = await extractIdeas(transcripcion, resumenContexto)

      if (result.error) {
        setError(result.error)
      } else {
        setIdeas(result.ideas)
        setHasLoaded(true)
      }
    } catch (err: any) {
      if (err.message === 'UPGRADE_REQUIRED') {
        setError('UPGRADE_REQUIRED')
      } else {
        setError(err.message || 'Error al extraer ideas')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // ── Estado: plan insuficiente ────────────────────────────
  if (!canUseIdeas) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card p-8 text-center"
      >
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-base font-semibold mb-2">Idea Extraction Engine</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
          Convierte cada podcast en 10-15 ideas de contenido listas para publicar en Twitter, LinkedIn, carrusel y vídeo.
        </p>
        <Button variant="default" size="sm" className="gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          Actualizar al plan Studio
        </Button>
      </motion.div>
    )
  }

  // ── Estado: inicial (sin cargar) ─────────────────────────
  if (!hasLoaded && !isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card p-8 text-center"
      >
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Brain className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-base font-semibold mb-2">Idea Extraction Engine</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
          Analiza la transcripción completa y extrae las ideas más potentes con contenido listo para publicar en 4 plataformas.
        </p>
        <Button onClick={handleExtract} className="gap-2">
          <Sparkles className="w-4 h-4" />
          Extraer ideas virales
        </Button>
      </motion.div>
    )
  }

  // ── Estado: cargando ─────────────────────────────────────
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl border border-border bg-card p-10 flex flex-col items-center gap-4"
      >
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-primary"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Extrayendo ideas virales...</p>
          <p className="text-xs text-muted-foreground mt-1">Analizando la transcripción completa</p>
        </div>
      </motion.div>
    )
  }

  // ── Estado: error ────────────────────────────────────────
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center"
      >
        <p className="text-sm text-red-400 mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={handleExtract}>
          Reintentar
        </Button>
      </motion.div>
    )
  }

  // ── Estado: ideas cargadas ───────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Ideas virales detectadas</h3>
            <p className="text-xs text-muted-foreground">{ideas.length} ideas · 4 formatos por idea</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExtract}
          className="text-xs gap-1.5 text-muted-foreground"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Regenerar
        </Button>
      </div>

      {/* Lista de ideas */}
      <div className="space-y-3">
        {ideas.map((idea, i) => (
          <IdeaCard key={`${idea.tema}-${i}`} idea={idea} index={i} />
        ))}
      </div>
    </motion.div>
  )
}
