'use client'

import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { InputScreen } from '@/components/screens/input-screen'
import { ProcessingScreen } from '@/components/screens/processing-screen'
import { ResultsScreen } from '@/components/screens/results-screen'
import { cn } from '@/lib/utils'
import { submitYouTubeUrl, uploadFile } from '@/lib/api'
import type { RadarResult } from '@/lib/api'
import { addToHistory, saveResult, loadResult } from '@/components/layout/sidebar'
import type { AnalysisHistoryItem } from '@/components/layout/sidebar'
import { useAuth } from '@/components/auth/auth-provider'

type AppView = 'input' | 'processing' | 'results'

export default function PodForgePage() {
  const [currentView, setCurrentView] = useState<AppView>('input')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Estado real de la app
  const [jobId, setJobId] = useState<string | null>(null)
  const [radarResult, setRadarResult] = useState<RadarResult | null>(null)
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const { refreshCredits, user, remoteHistory } = useAuth()

  const handleNewAnalysis = () => {
    setCurrentView('input')
    setJobId(null)
    setRadarResult(null)
    setError(null)
    setVideoUrl('')
  }

  const handleStartAnalysis = useCallback(async (url: string, file: File | null) => {
    setError(null)

    try {
      let response
      if (file) {
        response = await uploadFile(file)
      } else {
        setVideoUrl(url)
        response = await submitYouTubeUrl(url)
      }

      setJobId(response.job_id)
      setCurrentView('processing')
    } catch (err: any) {
      setError(err.message || 'Error al enviar el análisis')
    }
  }, [])

  const handleSelectHistory = useCallback((item: AnalysisHistoryItem) => {
    // Intentar cargar desde localStorage primero
    const saved = loadResult(item.id) as RadarResult | null
    if (saved) {
      setVideoUrl(item.videoUrl || '')
      setRadarResult(saved)
      setCurrentView('results')
      return
    }
    // Si no hay en localStorage, buscar en el historial remoto
    const remoteItem = remoteHistory.find(r => r.id === item.id)
    if (remoteItem?.resultado_json) {
      setVideoUrl(item.videoUrl || '')
      setRadarResult(remoteItem.resultado_json as RadarResult)
      setCurrentView('results')
    }
  }, [remoteHistory])

  const handleProcessingComplete = useCallback((result: RadarResult) => {
    setRadarResult(result)
    setCurrentView('results')

    // Guardar en historial solo si el usuario está autenticado
    if (user) {
      const id = jobId || Date.now().toString()
      const topClip = result.clips[0]
      const historyItem: AnalysisHistoryItem = {
        id,
        title: topClip?.topic || videoUrl || 'Análisis sin título',
        date: new Date().toISOString(),
        status: 'completed',
        clipsCount: result.clips.length,
        videoUrl,
      }
      addToHistory(historyItem)
      saveResult(id, result)
    }

    // Refrescar créditos
    refreshCredits()
  }, [jobId, videoUrl, refreshCredits, user])

  const handleBackToInput = () => {
    setCurrentView('input')
  }

  return (
    <div className="flex min-h-screen bg-background overflow-hidden">
      <Sidebar 
        onNewAnalysis={handleNewAnalysis}
        onSelectHistory={handleSelectHistory}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        remoteHistory={remoteHistory}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative">
        {currentView !== 'results' && (
          <Header 
            currentView={currentView} 
            sidebarCollapsed={sidebarCollapsed}
          />
        )}

        <main className={cn(
          "flex-1 transition-all duration-200",
          currentView !== 'results' && "pt-16"
        )}>
          <AnimatePresence mode="wait">
            {currentView === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <InputScreen
                  onStartAnalysis={handleStartAnalysis}
                  error={error}
                />
              </motion.div>
            )}

            {currentView === 'processing' && jobId && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <ProcessingScreen
                  jobId={jobId}
                  onComplete={handleProcessingComplete}
                />
              </motion.div>
            )}

            {currentView === 'results' && radarResult && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                <ResultsScreen
                  radarResult={radarResult}
                  videoUrl={videoUrl}
                  onBack={handleBackToInput}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </div>
      </div>
    </div>
  )
}
