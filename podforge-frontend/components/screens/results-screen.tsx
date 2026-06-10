"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { ArrowLeft, Share2, Download, Clock, Zap, LayoutGrid, FileText, Brain } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TopViralMoment } from "@/components/dashboard/top-viral-moment"
import { ViralPatterns } from "@/components/dashboard/viral-patterns"
import { RadarOverview } from "@/components/dashboard/radar-overview"
import { ClipsGrid } from "@/components/dashboard/clips-grid"
import { ClipPreviewModal } from "@/components/dashboard/clip-preview-modal"
import { TranscriptView } from "@/components/dashboard/transcript-view"
import { IdeasPanel } from "@/components/dashboard/ideas-panel"
import { Clip } from "@/lib/mock-data"
import type { RadarResult } from "@/lib/api"

interface ResultsScreenProps {
  radarResult: RadarResult
  videoUrl?: string
  canUseIdeas?: boolean   // controlado por el plan del usuario
  onBack: () => void
}

export function ResultsScreen({ radarResult, videoUrl = '', canUseIdeas = false, onBack }: ResultsScreenProps) {
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const clips = useMemo(() => radarResult.clips || [], [radarResult])
  const transcripcion = radarResult.transcripcion
  const resumenContexto = radarResult.resumen_contexto

  // Sort clips by viral score to get the top one
  const sortedClips = useMemo(() => [...clips].sort((a, b) => b.viral_score - a.viral_score), [clips])
  const topClip = sortedClips[0]
  const otherClips = sortedClips.slice(1)

  const handlePreview = (clip: Clip) => {
    setSelectedClip(clip)
    setIsPreviewOpen(true)
  }

  const handleClosePreview = () => {
    setIsPreviewOpen(false)
    setTimeout(() => setSelectedClip(null), 200)
  }

  const handleExport = () => {
    const exportData = {
      source: videoUrl,
      analyzed_at: new Date().toISOString(),
      total_clips: clips.length,
      clips: clips.map((clip, i) => ({
        clip_number: i + 1,
        start: clip.start,
        end: clip.end,
        duration_seconds: clip.duration_seconds,
        topic: clip.topic,
        frase_clave: clip.frase_clave,
        type: clip.type,
        clip_tipo: clip.clip_tipo,
        viral_score: clip.viral_score,
        intensidad_hook: clip.intensidad_hook,
        platform_fit: clip.platform_fit,
        copy: null,
      })),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `podforge-creator-pack-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Calculate totals
  const totalDuration = clips.reduce((acc, clip) => acc + clip.duration_seconds, 0)
  const avgViralScore = Math.round(clips.reduce((acc, clip) => acc + clip.viral_score, 0) / clips.length)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen"
    >
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 md:px-6 py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver
              </Button>
              <div className="h-6 w-px bg-border hidden md:block" />
              <div>
                <h1 className="text-lg md:text-xl font-semibold text-foreground line-clamp-1">
                  Resultados del análisis
                </h1>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                    {clips.length} clips
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {Math.floor(totalDuration / 60)}:{(totalDuration % 60).toString().padStart(2, '0')} total
                  </span>
                  <Badge variant="outline" className="text-xs">
                    Avg Score: {avgViralScore}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="gap-1.5 flex-1 md:flex-initial"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">📦 Creator Pack</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-4 md:px-6 py-6 space-y-8">
        {/* Zone A: Top Viral Moment */}
        {topClip && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🏆</span>
              <h2 className="text-xl font-semibold">Momento Viral Destacado</h2>
            </div>
            <TopViralMoment
              clip={topClip}
              transcripcion={transcripcion}
              resumenContexto={resumenContexto}
              onPreview={handlePreview}
            />
          </section>
        )}

        {/* Zone B & C: Patterns and Radar */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ViralPatterns clips={clips} />
          <RadarOverview clips={clips} onSelectClip={handlePreview} />
        </section>

        {/* Zone D: Clips Grid + Ideas + Transcript Tabs */}
        <section>
          <Tabs defaultValue="clips" className="w-full">
            <TabsList className="mb-4 bg-secondary/50">
              <TabsTrigger value="clips" className="gap-2">
                <LayoutGrid className="w-4 h-4" />
                Radar de Clips
              </TabsTrigger>
              <TabsTrigger value="ideas" className="gap-2">
                <Brain className="w-4 h-4" />
                Ideas Virales
              </TabsTrigger>
              <TabsTrigger value="transcript" className="gap-2">
                <FileText className="w-4 h-4" />
                Transcripción Completa
              </TabsTrigger>
            </TabsList>

            <TabsContent value="clips">
              <ClipsGrid
                clips={otherClips}
                transcripcion={transcripcion}
                resumenContexto={resumenContexto}
                onPreview={handlePreview}
              />
            </TabsContent>

            <TabsContent value="ideas">
              <IdeasPanel
                transcripcion={transcripcion}
                resumenContexto={resumenContexto}
                canUseIdeas={canUseIdeas}
              />
            </TabsContent>

            <TabsContent value="transcript">
              <TranscriptView transcripcion={transcripcion} />
            </TabsContent>
          </Tabs>
        </section>
      </div>

      {/* Clip Preview Modal */}
      <ClipPreviewModal
        clip={selectedClip}
        sourceVideoId={radarResult.source_video_id}
        sourceType={radarResult.source_type ?? 'video'}
        videoUrl={videoUrl}
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
      />
    </motion.div>
  )
}