"use client"

import { motion } from "framer-motion"
import { Clip, ClipType, clipTypeLabels } from "@/lib/mock-data"

interface ViralPatternsProps {
  clips: Clip[]
}

export function ViralPatterns({ clips }: ViralPatternsProps) {
  // Calculate pattern distribution
  const patternCounts = clips.reduce((acc, clip) => {
    acc[clip.type] = (acc[clip.type] || 0) + 1
    return acc
  }, {} as Record<ClipType, number>)

  const total = clips.length
  const patterns = Object.entries(patternCounts)
    .map(([type, count]) => ({
      type: type as ClipType,
      count,
      percentage: Math.round((count / total) * 100),
      ...clipTypeLabels[type as ClipType],
    }))
    .sort((a, b) => b.percentage - a.percentage)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="text-xl">🧠</span>
        Patrones Virales Detectados
      </h3>

      <div className="space-y-4">
        {patterns.map((pattern, index) => (
          <motion.div
            key={pattern.type}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between text-sm">
              <span className={`px-2 py-0.5 rounded border ${pattern.color}`}>
                {pattern.label}
              </span>
              <span className="text-muted-foreground font-medium">
                {pattern.percentage}% ({pattern.count} clips)
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pattern.percentage}%` }}
                transition={{ duration: 0.8, delay: 0.3 + index * 0.1, ease: "easeOut" }}
                className={`h-full rounded-full ${
                  pattern.type === 'contradiction' ? 'bg-rose-500' :
                  pattern.type === 'myth_busted' ? 'bg-amber-500' :
                  pattern.type === 'hot_take' ? 'bg-orange-500' :
                  'bg-emerald-500'
                }`}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{patterns[0]?.label}</span> es el patron dominante en este podcast, 
          lo que indica un estilo de comunicacion basado en {
            patterns[0]?.type === 'contradiction' ? 'desafiar creencias establecidas' :
            patterns[0]?.type === 'myth_busted' ? 'revelar verdades ocultas' :
            patterns[0]?.type === 'hot_take' ? 'opiniones audaces y directas' :
            'narrativas personales impactantes'
          }.
        </p>
      </div>
    </motion.div>
  )
}
