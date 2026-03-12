"use client"

import { motion } from "framer-motion"
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Clip, clipTypeLabels } from "@/lib/mock-data"

interface RadarOverviewProps {
  clips: Clip[]
  onSelectClip: (clip: Clip) => void
}

// Custom tooltip component
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Clip }> }) {
  if (!active || !payload?.length) return null

  const clip = payload[0].payload
  const typeConfig = clipTypeLabels[clip.type]

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded border ${typeConfig.color}`}>
          {typeConfig.label}
        </span>
        <span className="text-sm font-bold text-primary">Score: {clip.viral_score}</span>
      </div>
      <p className="text-sm font-medium text-foreground mb-1">{clip.topic}</p>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Engagement: {Math.round(clip.factors.engagement_potential * 100)}%</p>
        <p>Controversia: {Math.round(clip.factors.controversy * 100)}%</p>
        <p>Hook: {clip.intensidad_hook}/5</p>
      </div>
    </div>
  )
}

export function RadarOverview({ clips, onSelectClip }: RadarOverviewProps) {
  // Transform clips data for scatter plot
  // factors son decimales 0.0-1.0, multiplicamos x100 para el dominio [0-100]
  const data = clips.map(clip => ({
    ...clip,
    x: Math.round(clip.factors.engagement_potential * 100),
    y: Math.round(clip.factors.controversy * 100),
    z: clip.intensidad_hook,
  }))

  // Color based on viral score
  const getColor = (score: number) => {
    if (score >= 90) return "oklch(0.7 0.25 320)" // Primary fuchsia
    if (score >= 80) return "oklch(0.6 0.25 290)" // Violet
    if (score >= 70) return "oklch(0.65 0.2 200)" // Cyan
    return "oklch(0.5 0.1 250)" // Muted
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="text-xl">📊</span>
        Mapa de Viralidad
      </h3>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
            <XAxis
              type="number"
              dataKey="x"
              domain={[0, 100]}
              name="Engagement"
              tick={{ fill: 'oklch(0.6 0 0)', fontSize: 12 }}
              tickLine={{ stroke: 'oklch(0.25 0.005 285)' }}
              axisLine={{ stroke: 'oklch(0.25 0.005 285)' }}
              label={{
                value: 'Engagement Potential',
                position: 'bottom',
                offset: 0,
                fill: 'oklch(0.6 0 0)',
                fontSize: 12,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[0, 100]}
              name="Controversy"
              tick={{ fill: 'oklch(0.6 0 0)', fontSize: 12 }}
              tickLine={{ stroke: 'oklch(0.25 0.005 285)' }}
              axisLine={{ stroke: 'oklch(0.25 0.005 285)' }}
              label={{
                value: 'Controversia',
                angle: -90,
                position: 'insideLeft',
                fill: 'oklch(0.6 0 0)',
                fontSize: 12,
              }}
            />
            <ZAxis
              type="number"
              dataKey="z"
              range={[100, 400]}
              name="Hook Intensity"
            />
            <Tooltip content={<CustomTooltip />} />
            <Scatter
              data={data}
              onClick={(data) => onSelectClip(data as unknown as Clip)}
              cursor="pointer"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getColor(entry.viral_score)}
                  fillOpacity={0.8}
                  stroke={getColor(entry.viral_score)}
                  strokeWidth={2}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span>Score 90+</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-accent" />
          <span>Score 80-89</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'oklch(0.65 0.2 200)' }} />
          <span>Score 70-79</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'oklch(0.5 0.1 250)' }} />
          <span>{'Score <70'}</span>
        </div>
      </div>
    </motion.div>
  )
}
