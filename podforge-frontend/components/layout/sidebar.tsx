'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Zap, 
  Plus, 
  History, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  Clock,
  Menu,
  X,
  AlertCircle,
  Trash2,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { RemoteHistoryItem } from '@/lib/api'

// ─── Historial real con localStorage ───

export interface AnalysisHistoryItem {
  id: string
  title: string
  date: string
  status: 'completed' | 'processing' | 'failed'
  clipsCount?: number
  videoUrl?: string
}

const HISTORY_KEY = 'podforge_analysis_history'
const RESULT_KEY_PREFIX = 'podforge_result_'
const MAX_HISTORY = 20

export function getHistory(): AnalysisHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addToHistory(item: AnalysisHistoryItem) {
  const history = getHistory()
  const filtered = history.filter(h => h.id !== item.id)
  const updated = [item, ...filtered].slice(0, MAX_HISTORY)
  // Limpia resultados de los análisis que ya no están en el historial
  filtered.slice(MAX_HISTORY - 1).forEach(old => {
    localStorage.removeItem(`${RESULT_KEY_PREFIX}${old.id}`)
  })
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  window.dispatchEvent(new Event('podforge_history_update'))
}

export function saveResult(id: string, result: unknown) {
  try {
    localStorage.setItem(`${RESULT_KEY_PREFIX}${id}`, JSON.stringify(result))
  } catch {
    // localStorage lleno — no bloqueamos la app
    console.warn('PodForge: localStorage lleno, no se pudo guardar el resultado.')
  }
}

export function loadResult(id: string): unknown | null {
  try {
    const raw = localStorage.getItem(`${RESULT_KEY_PREFIX}${id}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearHistory() {
  const history = getHistory()
  history.forEach(item => localStorage.removeItem(`${RESULT_KEY_PREFIX}${item.id}`))
  localStorage.removeItem(HISTORY_KEY)
  window.dispatchEvent(new Event('podforge_history_update'))
}

// ─── Componente ───

interface SidebarProps {
  onNewAnalysis: () => void
  onSelectHistory: (item: AnalysisHistoryItem) => void
  collapsed: boolean
  onToggleCollapse: () => void
  remoteHistory?: RemoteHistoryItem[]
  isLoadingHistory?: boolean
  onClearRemoteHistory?: () => Promise<void>
}

function AnalysisItem({ item, collapsed, onSelect }: { item: AnalysisHistoryItem; collapsed: boolean; onSelect: (item: AnalysisHistoryItem) => void }) {
  const statusIcon = {
    completed: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    processing: <Clock className="w-4 h-4 text-amber-400 animate-pulse" />,
    failed: <AlertCircle className="w-4 h-4 text-red-400" />,
  }

  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => onSelect(item)}
      disabled={item.status !== 'completed'}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
        "bg-secondary/50 hover:bg-secondary transition-colors",
        "text-left group border border-transparent hover:border-primary/20",
        collapsed && "justify-center px-2",
        item.status === 'completed' ? "cursor-pointer" : "cursor-default opacity-60"
      )}
    >
      <div className="shrink-0">
        {statusIcon[item.status]}
      </div>
      
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground truncate group-hover:text-primary transition-colors">
            {item.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(item.date).toLocaleDateString('es-ES', { 
              day: 'numeric', 
              month: 'short' 
            })}
            {item.clipsCount !== undefined && (
              <span className="ml-1">· {item.clipsCount} clips</span>
            )}
          </p>
        </div>
      )}
    </motion.button>
  )
}

export function Sidebar({ onNewAnalysis, onSelectHistory, collapsed, onToggleCollapse, remoteHistory = [], isLoadingHistory = false, onClearRemoteHistory }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [localHistory, setLocalHistory] = useState<AnalysisHistoryItem[]>([])

  // Cargar historial local al montar y escuchar actualizaciones
  useEffect(() => {
    setLocalHistory(getHistory())

    const handleUpdate = () => setLocalHistory(getHistory())
    window.addEventListener('podforge_history_update', handleUpdate)
    return () => window.removeEventListener('podforge_history_update', handleUpdate)
  }, [])

  // Si hay historial remoto (usuario logueado), usarlo. Si no, usar localStorage.
  const history: AnalysisHistoryItem[] = remoteHistory.length > 0
    ? remoteHistory.map(r => ({
        id: r.id,
        title: r.title,
        date: r.date,
        status: r.status,
        clipsCount: r.clipsCount,
        videoUrl: r.videoUrl ?? undefined,
      }))
    : localHistory

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-2 px-4 py-6",
        collapsed && "justify-center px-2"
      )}>
        <div className="relative">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-accent blur-lg opacity-50" />
        </div>
        
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="font-bold text-xl tracking-tight text-gradient overflow-hidden whitespace-nowrap"
            >
              PodForge
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* New Analysis Button */}
      <div className={cn("px-3 mb-6", collapsed && "px-2")}>
        <Button
          onClick={onNewAnalysis}
          className={cn(
            "w-full bg-gradient-to-r from-primary to-accent hover:opacity-90",
            "text-white font-medium shadow-lg",
            "border-0 transition-all duration-300",
            "hover:shadow-primary/25 hover:shadow-xl",
            collapsed ? "px-2" : "gap-2"
          )}
        >
          <Plus className="w-4 h-4" />
          {!collapsed && <span>Nuevo análisis</span>}
        </Button>
      </div>

      {/* History Section */}
      <div className={cn("px-3 flex-1", collapsed && "px-2")}>
        {!collapsed && (
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <History className="w-3.5 h-3.5" />
              <span>Historial</span>
            </div>
            {history.length > 0 && (
              <button
                onClick={async () => {
                  if (onClearRemoteHistory && remoteHistory.length > 0) {
                    try {
                      await onClearRemoteHistory()
                    } catch (e) {
                      console.error(e)
                    }
                  } else {
                    clearHistory(); setLocalHistory([])
                  }
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 transition-colors"
                title="Limpiar historial"
              >
                <Trash2 className="w-3 h-3" />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        )}
        
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="space-y-2 pr-2">
            {isLoadingHistory && !collapsed && (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Cargando...</span>
              </div>
            )}
            {!isLoadingHistory && history.length === 0 && !collapsed && (
              <p className="text-xs text-muted-foreground text-center py-8 opacity-60">
                Aún no has analizado ningún video
              </p>
            )}
            {history.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <AnalysisItem item={item} collapsed={collapsed} onSelect={onSelectHistory} />
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className={cn(
        "px-4 py-4 border-t border-border",
        collapsed && "px-2"
      )}>
        <p className={cn(
          "text-xs text-muted-foreground",
          collapsed ? "text-center" : ""
        )}>
          {collapsed ? "v1.0" : "PodForge v1.0.0"}
        </p>
      </div>

      {/* Collapse Toggle (Desktop) */}
      <button
        onClick={onToggleCollapse}
        className={cn(
          "hidden lg:flex absolute top-1/2 -translate-y-1/2 -right-3",
          "w-6 h-6 rounded-full bg-card border border-border",
          "items-center justify-center",
          "hover:bg-secondary hover:border-primary/30 transition-colors",
          "shadow-md"
        )}
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
    </>
  )

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/60 z-40"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed left-0 top-0 h-full w-72 bg-sidebar border-r border-sidebar-border z-50 flex flex-col"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-secondary flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 280 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={cn(
          "hidden lg:flex flex-col h-screen",
          "bg-sidebar border-r border-sidebar-border",
          "fixed left-0 top-0 z-30",
          "relative"
        )}
      >
        {sidebarContent}
      </motion.aside>
    </>
  )
}