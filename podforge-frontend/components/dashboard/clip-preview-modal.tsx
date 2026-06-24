"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { RefreshCw, Clock, X, Music } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Clip, clipTypeLabels } from "@/lib/mock-data"
import { getYouTubeEmbedUrl, formatDuration } from "@/lib/youtube-utils"
import { generateVideoClip, pollUntilDone } from "@/lib/api"

interface ClipPreviewModalProps {
  clip: Clip | null
  sourceVideoId?: string
  sourceType?: 'video' | 'audio'
  videoUrl?: string
  isOpen: boolean
  onClose: () => void
}

export function ClipPreviewModal({ clip, sourceVideoId, sourceType = 'video', videoUrl, isOpen, onClose }: ClipPreviewModalProps) {
  const [loop, setLoop] = useState(false)
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [key, setKey] = useState(0)
  const [localMediaUrl, setLocalMediaUrl] = useState<string | null>(null)
  const [localMediaType, setLocalMediaType] = useState<'video' | 'audio'>('video')
  const [isGeneratingMedia, setIsGeneratingMedia] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)

  const handleGenerateLocalMedia = async (currentClip: Clip, currentSource: string) => {
    setIsGeneratingMedia(true)
    setMediaError(null)

    const parseTime = (timeStr: string) => {
      const parts = timeStr.split(':')
      if (parts.length === 3) {
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2])
      }
      return parseInt(parts[0]) * 60 + parseInt(parts[1])
    }

    try {
      const startTime = parseTime(currentClip.start)
      const endTime = parseTime(currentClip.end)

      const { job_id } = await generateVideoClip(currentSource, startTime, endTime, sourceType)

      pollUntilDone(job_id, () => { }, 1000).promise
        .then((result: any) => {
          if (result && result.media_url) {
            setLocalMediaUrl(result.media_url)
            setLocalMediaType(result.media_type || sourceType)
          } else {
            setMediaError('Error obteniendo el archivo recortado.')
          }
          setIsGeneratingMedia(false)
        })
        .catch((err: any) => {
          setMediaError(err.message || 'Fallo al recortar')
          setIsGeneratingMedia(false)
        })
    } catch (err: any) {
      setMediaError(err.message || 'Error solicitando recorte')
      setIsGeneratingMedia(false)
    }
  }

  useEffect(() => {
    if (clip && isOpen) {
      if (videoUrl && sourceType === 'video') {
        const url = getYouTubeEmbedUrl(videoUrl, clip.start, clip.end, loop)
        setEmbedUrl(url)
      } else {
        setEmbedUrl(null)
      }
    }
  }, [clip, isOpen, loop, videoUrl, sourceType])

  useEffect(() => {
    if (clip && isOpen) {
      setLocalMediaUrl(null)
      setMediaError(null)
      if (sourceVideoId) {
        handleGenerateLocalMedia(clip, sourceVideoId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip, isOpen, sourceVideoId])

  const handleLoopToggle = (checked: boolean) => {
    setLoop(checked)
    setKey(prev => prev + 1) // Force iframe reload
  }

  const handleReplay = () => {
    setKey(prev => prev + 1)
  }

  if (!clip) return null

  const typeConfig = clipTypeLabels[clip.type]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-card border-border">
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className={`${typeConfig.color} border`}>
                  {typeConfig.label}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(clip.duration_seconds)}
                </Badge>
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  Score: {clip.viral_score}
                </Badge>
              </div>
              <DialogTitle className="text-lg font-semibold pr-8">
                {clip.topic}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        {/* Player — se adapta a audio o vídeo */}
        {sourceType === 'audio' ? (
          /* ── AUDIO PLAYER ─────────────────────────────── */
          <div className="bg-black flex flex-col items-center justify-center px-6 py-10 gap-6 min-h-[200px]">
            {localMediaUrl ? (
              <div className="w-full flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <Music className="w-8 h-8 text-primary" />
                </div>
                <audio
                  key={`${key}-audio`}
                  src={localMediaUrl}
                  controls
                  autoPlay
                  loop={loop}
                  className="w-full max-w-md"
                />
                <p className="text-xs text-muted-foreground">Fragmento de audio recortado</p>
              </div>
            ) : isGeneratingMedia ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Music className="w-8 h-8 opacity-50 animate-pulse" />
                <p className="font-medium">Recortando fragmento de audio...</p>
                <p className="text-xs opacity-70">Esto tardará un par de segundos.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Music className="w-8 h-8 opacity-20" />
                <p>Preparando audio...</p>
              </div>
            )}
            {mediaError && (
              <div className="w-full bg-red-500/90 text-white text-xs p-2 rounded text-center">
                {mediaError}
              </div>
            )}
          </div>
        ) : (
          /* ── VIDEO PLAYER ─────────────────────────────── */
          <div className="relative aspect-video bg-black flex flex-col items-center justify-center">
            {localMediaUrl ? (
              <video
                key={`${key}-local`}
                src={localMediaUrl}
                controls
                autoPlay
                loop={loop}
                className="w-full h-full object-contain"
              />
            ) : isGeneratingMedia ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Clock className="w-8 h-8 opacity-50 animate-spin" />
                <p className="font-medium">Generando el clip original HD...</p>
                <p className="text-xs opacity-70">Esto tardará un par de segundos.</p>
              </div>
            ) : embedUrl ? (
              <motion.iframe
                key={key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                <Clock className="w-8 h-8 opacity-20 mb-2" />
                <p>Cargando previsualización...</p>
              </div>
            )}
            {mediaError && (
              <div className="absolute top-2 left-2 right-2 bg-red-500/90 text-white text-xs p-2 rounded truncate">
                {mediaError}
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="p-4 border-t border-border bg-secondary/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Timestamps */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Fragmento:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm bg-card px-2 py-1 rounded border border-border">
                  {clip.start}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="font-mono text-sm bg-card px-2 py-1 rounded border border-border">
                  {clip.end}
                </span>
              </div>
            </div>

            {/* Loop toggle and replay */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="loop-mode"
                  checked={loop}
                  onCheckedChange={handleLoopToggle}
                />
                <Label htmlFor="loop-mode" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Loop clip
                </Label>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleReplay}
                className="gap-1.5"
                disabled={isGeneratingMedia}
              >
                <RefreshCw className="w-4 h-4" />
                Replay
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Key phrase */}
            <blockquote className="border-l-2 border-primary pl-3 py-2 bg-primary/5 rounded-r flex-1 w-full">
              <p className="text-sm italic text-foreground/80">
                &ldquo;{clip.frase_clave}&rdquo;
              </p>
            </blockquote>

            {/* Generate Local MP4 Button (Removed since it's automatic now, leaving space) */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
