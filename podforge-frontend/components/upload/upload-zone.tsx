'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileAudio, X, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UploadZoneProps {
  onFileSelect: (file: File | null) => void
  selectedFile: File | null
}

export function UploadZone({ onFileSelect, selectedFile }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    if (file && (file.type.startsWith('audio/') || file.type.startsWith('video/'))) {
      onFileSelect(file)
    }
  }, [onFileSelect])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }, [onFileSelect])

  const removeFile = useCallback(() => {
    onFileSelect(null)
  }, [onFileSelect])

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {selectedFile ? (
          <motion.div
            key="selected"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              "relative flex items-center gap-4 p-4 rounded-xl",
              "bg-card border border-primary/30",
              "border-glow"
            )}
          >
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <FileAudio className="w-6 h-6 text-primary" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-medium truncate">
                {selectedFile.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>

            <button
              onClick={removeFile}
              className="w-8 h-8 rounded-full bg-secondary hover:bg-destructive/20 hover:text-destructive transition-colors flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ) : (
          <motion.label
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative flex flex-col items-center justify-center p-8 rounded-xl cursor-pointer",
              "border-2 border-dashed transition-all duration-300",
              isDragging 
                ? "border-primary bg-primary/5 border-glow" 
                : "border-border hover:border-primary/50 hover:bg-card/50",
            )}
          >
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <motion.div
              animate={isDragging ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }}
              className={cn(
                "w-14 h-14 rounded-xl flex items-center justify-center mb-4",
                "bg-gradient-to-br from-primary/20 to-accent/20",
                isDragging && "animate-pulse-glow"
              )}
            >
              <Upload className={cn(
                "w-7 h-7 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
            </motion.div>
            
            <p className="text-foreground font-medium mb-1">
              {isDragging ? 'Suelta el archivo aquí' : 'Arrastra un archivo de audio o video'}
            </p>
            <p className="text-sm text-muted-foreground">
              o <span className="text-primary hover:underline">busca en tu dispositivo</span>
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2">
              MP3, MP4, WAV, M4A hasta 500MB
            </p>
          </motion.label>
        )}
      </AnimatePresence>
    </div>
  )
}
