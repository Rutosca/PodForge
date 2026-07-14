'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ProcessingStep } from '@/components/processing/processing-step'
import { processingSteps } from '@/lib/mock-data'
import { pollUntilDone } from '@/lib/api'
import type { RadarResult } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ProcessingScreenProps {
  jobId: string
  onComplete: (result: RadarResult) => void
}

export function ProcessingScreen({ jobId, onComplete }: ProcessingScreenProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RadarResult | null>(null)
  const cancelRef = useRef<(() => void) | null>(null)
  const hasRealProgressRef = useRef(false)

  // Polling real al backend
  useEffect(() => {
    const { promise, cancel } = pollUntilDone(
      jobId,
      (status) => {
        // Progreso real reportado por el worker (job.meta)
        if (typeof status.progress === 'number' && status.progress > 0) {
          hasRealProgressRef.current = true
          setProgress(prev => Math.max(prev, status.progress as number))
        }
        if (status.step) {
          const stepIndex = processingSteps.findIndex(s => s.id === status.step)
          if (stepIndex >= 0) {
            setCurrentStepIndex(prev => Math.max(prev, stepIndex))
          }
        }

        // Fallback: si el backend no reporta progreso, avanzamos un paso visual por tick
        if (!hasRealProgressRef.current) {
          setCurrentStepIndex(prev => {
            const next = prev + 1
            // No pasamos del penúltimo hasta que termine de verdad
            return Math.min(next, processingSteps.length - 2)
          })
        }
      },
      2000
    )

    cancelRef.current = cancel

    promise
      .then((radarResult) => {
        // Completar todos los pasos visuales
        setCurrentStepIndex(processingSteps.length)
        setProgress(100)
        setIsComplete(true)
        setResult(radarResult)
      })
      .catch((err) => {
        setError(err.message || 'Error durante el análisis')
      })

    return () => cancel()
  }, [jobId])

  // Fallback: animar progreso basado en el step actual solo si no hay progreso real
  useEffect(() => {
    if (isComplete) {
      setProgress(100)
      return
    }
    if (hasRealProgressRef.current) return
    const targetProgress = ((currentStepIndex + 1) / processingSteps.length) * 90 // Max 90% hasta completar
    setProgress(prev => Math.max(prev, targetProgress))
  }, [currentStepIndex, isComplete])

  const getStepStatus = (index: number): 'pending' | 'active' | 'completed' => {
    if (index < currentStepIndex) return 'completed'
    if (index === currentStepIndex) return 'active'
    return 'pending'
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <motion.div
          animate={{ 
            rotate: isComplete ? 0 : [0, 5, -5, 0],
            scale: isComplete ? [1, 1.2, 1] : 1
          }}
          transition={{ 
            rotate: { duration: 0.5, repeat: isComplete ? 0 : Infinity, repeatDelay: 2 },
            scale: { duration: 0.3 }
          }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mb-6 relative"
        >
          <Sparkles className={cn(
            "w-10 h-10 transition-colors duration-300",
            error ? "text-red-400" : isComplete ? "text-emerald-400" : "text-primary"
          )} />
          <motion.div 
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-accent"
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ filter: 'blur(20px)' }}
          />
        </motion.div>

        <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-balance">
          {error ? (
            <span className="text-red-400">Error en el análisis</span>
          ) : isComplete ? (
            <span className="text-gradient">¡Análisis completado!</span>
          ) : (
            <>Analizando tu <span className="text-gradient">podcast</span></>
          )}
        </h2>
        <p className="text-muted-foreground">
          {error 
            ? error
            : isComplete 
            ? 'Hemos encontrado los mejores momentos de tu contenido'
            : 'Esto puede tomar unos minutos. No cierres esta ventana.'
          }
        </p>
      </motion.div>

      {/* Processing Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={cn(
          "w-full max-w-lg p-6 sm:p-8 rounded-2xl",
          "bg-card/80 backdrop-blur-sm",
          "border border-border",
          "shadow-xl shadow-black/20"
        )}
      >
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">Progreso</span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <div className="relative">
            <Progress 
              value={progress} 
              className="h-2 bg-secondary"
            />
            <motion.div
              className="absolute top-0 left-0 h-2 rounded-full bg-gradient-to-r from-primary to-accent"
              style={{ width: `${progress}%` }}
              animate={{ 
                boxShadow: ['0 0 10px oklch(0.7 0.25 320 / 0.5)', '0 0 20px oklch(0.7 0.25 320 / 0.7)', '0 0 10px oklch(0.7 0.25 320 / 0.5)'] 
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
        </div>

        {/* Steps List */}
        <div className="space-y-2">
          {processingSteps.map((step, index) => (
            <ProcessingStep
              key={step.id}
              label={step.label}
              status={error ? (index <= currentStepIndex ? 'completed' : 'pending') : getStepStatus(index)}
              index={index}
            />
          ))}
        </div>

        {/* Error retry */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </motion.div>
        )}

        {/* Complete Button */}
        {isComplete && result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8"
          >
            <Button
              onClick={() => onComplete(result)}
              size="lg"
              className={cn(
                "w-full h-14 text-lg font-semibold",
                "bg-gradient-to-r from-primary to-accent",
                "hover:from-primary/90 hover:to-accent/90",
                "border-0 text-white shadow-2xl",
                "hover:shadow-primary/30 hover:shadow-2xl"
              )}
            >
              Ver Resultados ({result.clips.length} clips)
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* Animated background particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-primary/30"
            initial={{
              x: `${20 + i * 15}vw`,
              y: '110vh',
            }}
            animate={{
              y: '-10vh',
              x: `${10 + i * 12}vw`,
            }}
            transition={{
              duration: 10 + i * 2,
              repeat: Infinity,
              delay: i * 1.5,
              ease: 'linear',
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}
