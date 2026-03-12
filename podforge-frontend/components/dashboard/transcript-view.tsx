"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { Search, Copy, Check, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TranscriptSegment } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

interface TranscriptViewProps {
  transcript?: TranscriptSegment[]
  transcripcion?: string
}

function parseTranscripcion(text: string): TranscriptSegment[] {
  return text.split('\n').filter(line => line.trim()).map((line, i) => {
    const match = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.*)/)
    if (match) {
      return { timestamp: match[1], text: match[2] }
    }
    return { timestamp: `${Math.floor(i * 15 / 60)}:${(i * 15 % 60).toString().padStart(2, '0')}`, text: line }
  })
}

export function TranscriptView({ transcript, transcripcion }: TranscriptViewProps) {
  // Prioridad: transcript prop > parsear transcripcion string > array vacío
  const segments: TranscriptSegment[] = useMemo(() => {
    if (transcript && transcript.length > 0) return transcript
    if (transcripcion && transcripcion.trim()) return parseTranscripcion(transcripcion)
    return []
  }, [transcript, transcripcion])
  const [searchQuery, setSearchQuery] = useState("")
  const [copied, setCopied] = useState(false)

  const filteredTranscript = useMemo(() => {
    if (!searchQuery.trim()) return segments
    
    const query = searchQuery.toLowerCase()
    return segments.filter(segment => 
      segment.text.toLowerCase().includes(query) ||
      segment.timestamp.includes(query)
    )
  }, [segments, searchQuery])

  const handleCopyTranscript = async () => {
    const fullText = segments
      .map(segment => `[${segment.timestamp}] ${segment.text}`)
      .join('\n\n')
    
    try {
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = fullText
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-primary/30 text-primary px-0.5 rounded">
          {part}
        </mark>
      ) : part
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-card rounded-xl border border-border overflow-hidden"
    >
      {/* Header with search and copy */}
      <div className="p-4 border-b border-border bg-secondary/30">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar en la transcripcion..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background/50 border-border/50 focus:border-primary/50"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyTranscript}
            className={cn(
              "gap-2 transition-colors shrink-0",
              copied && "border-emerald-500/50 text-emerald-400"
            )}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copiar Transcripcion
              </>
            )}
          </Button>
        </div>
        
        {searchQuery && (
          <p className="text-xs text-muted-foreground mt-2">
            {filteredTranscript.length} {filteredTranscript.length === 1 ? 'resultado' : 'resultados'} encontrados
          </p>
        )}
      </div>

      {/* Transcript content */}
      <div className="max-h-[600px] overflow-y-auto p-6">
        {segments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mb-3 opacity-50" />
            <p>No hay transcripción disponible</p>
          </div>
        ) : filteredTranscript.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mb-3 opacity-50" />
            <p>No se encontraron resultados para &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTranscript.map((segment, index) => (
              <div
                key={`${segment.timestamp}-${index}`}
                className="flex gap-4 group"
              >
                <span className="font-mono text-sm text-primary/70 shrink-0 pt-0.5 select-all">
                  [{segment.timestamp}]
                </span>
                <p className="text-foreground/80 leading-relaxed text-sm">
                  {highlightMatch(segment.text, searchQuery)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="px-6 py-3 border-t border-border bg-secondary/20">
        <p className="text-xs text-muted-foreground">
          {segments.length} segmentos de transcripcion
        </p>
      </div>
    </motion.div>
  )
}
