"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Download, ArrowUpDown, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Clip } from "@/lib/mock-data"
import { ClipCard } from "./clip-card"

interface ClipsGridProps {
  clips: Clip[]
  transcripcion: string
  resumenContexto: string
  onPreview: (clip: Clip) => void
}

type SortOption = 'viral_score' | 'tiktok' | 'instagram' | 'youtube_shorts' | 'twitter' | 'duration'

const sortLabels: Record<SortOption, string> = {
  viral_score: 'Viral Score',
  tiktok: 'TikTok Fit',
  instagram: 'Instagram Fit',
  youtube_shorts: 'YouTube Shorts Fit',
  twitter: 'Twitter/X Fit',
  duration: 'Duracion',
}

export function ClipsGrid({ clips, transcripcion, resumenContexto, onPreview }: ClipsGridProps) {
  const [sortBy, setSortBy] = useState<SortOption>('viral_score')

  const sortedClips = [...clips].sort((a, b) => {
    switch (sortBy) {
      case 'viral_score':
        return b.viral_score - a.viral_score
      case 'tiktok':
        return b.platform_fit.tiktok - a.platform_fit.tiktok
      case 'instagram':
        return b.platform_fit.instagram - a.platform_fit.instagram
      case 'youtube_shorts':
        return b.platform_fit.youtube_shorts - a.platform_fit.youtube_shorts
      case 'twitter':
        return b.platform_fit.twitter - a.platform_fit.twitter
      case 'duration':
        return a.duration_seconds - b.duration_seconds
      default:
        return 0
    }
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Clips Detectados
          </h3>
          <p className="text-sm text-muted-foreground">
            {clips.length} momentos virales listos para usar
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 flex-1 sm:flex-initial">
                <ArrowUpDown className="w-4 h-4" />
                {sortLabels[sortBy]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {Object.entries(sortLabels).map(([key, label]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setSortBy(key as SortOption)}
                  className={sortBy === key ? 'bg-primary/10 text-primary' : ''}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedClips.map((clip, index) => (
          <ClipCard
            key={clip.id || `clip-${index}`}
            clip={clip}
            index={index}
            transcripcion={transcripcion}
            resumenContexto={resumenContexto}
            onPreview={onPreview}
          />
        ))}
      </div>
    </motion.div>
  )
}
