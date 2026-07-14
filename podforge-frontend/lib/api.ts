/**
 * PodForge API Service
 * Conecta el frontend Next.js con el backend Flask.
 * Todas las llamadas pasan por el proxy de Next.js (/api/* → localhost:5000).
 */

import type { Clip, CopyResult } from './mock-data'
import { supabase } from './supabase'

// ─── HELPER: AUTH HEADERS ───

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    return { 'Authorization': `Bearer ${session.access_token}` }
  }
  return {}
}

// ─── TIPOS DE RESPUESTA DEL BACKEND ───

export interface RadarResult {
  transcripcion: string
  resumen_contexto: string
  clips: Clip[]
  source_video_id?: string
  source_type?: 'video' | 'audio'
}

interface JobResponse {
  job_id: string
  status: string
  message?: string
}

export interface StatusResponse {
  status: 'processing' | 'finished' | 'failed'
  result?: RadarResult
  error?: string
  /** Progreso real (0-100) reportado por el worker */
  progress?: number
  /** Paso actual: download | extract | transcribe | analyze | detect | generate */
  step?: string
}

// ─── FASE 1: ENVIAR VIDEO ───

export async function submitYouTubeUrl(url: string): Promise<JobResponse> {
  const formData = new FormData()
  formData.append('url', url)

  const authHeaders = await getAuthHeaders()

  const res = await fetch('/api/transformar', {
    method: 'POST',
    headers: { ...authHeaders },
    body: formData,
  })

  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Error ${res.status}`)
  }

  return res.json()
}

export async function uploadFile(file: File): Promise<JobResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const authHeaders = await getAuthHeaders()

  // Directo a Render, sin pasar por el proxy de Vercel
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

  const res = await fetch(`${apiUrl}/subir`, {
    method: 'POST',
    headers: { ...authHeaders },
    body: formData,
  })

  if (!res.ok) {
    let data: any = {}
    try { data = await res.json() } catch {}
    const err: any = new Error(data.error || `Error ${res.status}`)
    err.needsLogin = data.needs_login === true
    throw err
  }

  return res.json()
}

// ─── POLLING DE ESTADO ───

export async function checkStatus(jobId: string): Promise<StatusResponse> {
  const res = await fetch(`/api/status/${jobId}`)

  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Error ${res.status}`)
  }

  return res.json()
}

/**
 * Hace polling cada `intervalMs` hasta que el job termine o falle.
 * Llama a `onProgress` en cada tick para actualizar la UI.
 */
export function pollUntilDone(
  jobId: string,
  onProgress: (status: StatusResponse) => void,
  intervalMs = 2000
): { promise: Promise<RadarResult>; cancel: () => void } {
  let cancelled = false
  let timer: ReturnType<typeof setTimeout>

  const promise = new Promise<RadarResult>((resolve, reject) => {
    const tick = async () => {
      if (cancelled) return

      try {
        const status = await checkStatus(jobId)
        onProgress(status)

        if (status.status === 'finished' && status.result) {
          //Lanzar error si lo hay
          if ((status.result as any).error) {
            reject(new Error((status.result as any).error))
            return
          }
          
          resolve(status.result)
          return
        }

        if (status.status === 'failed') {
          reject(new Error(status.error || 'El análisis falló'))
          return
        }

        // Sigue procesando
        timer = setTimeout(tick, intervalMs)
      } catch (err) {
        reject(err)
      }
    }

    tick()
  })

  return {
    promise,
    cancel: () => {
      cancelled = true
      clearTimeout(timer)
    },
  }
}

// ─── FASE 3: GENERAR CLIP DE VÍDEO (FFMPEG) ───

export interface VideoClipResponse {
  media_url: string
  media_type: 'video' | 'audio'
}

export async function generateVideoClip(
  sourceVideoId: string,
  startTime: number,
  endTime: number,
  sourceType: 'video' | 'audio' = 'video'
): Promise<JobResponse> {
  const authHeaders = await getAuthHeaders()

  const res = await fetch('/api/generar-video-clip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      source_video_id: sourceVideoId,
      start_time: startTime,
      end_time: endTime,
      source_type: sourceType,
    }),
  })

  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Error ${res.status}`)
  }

  return res.json()
}

export interface IdeaFormats {
  tweet: string
  linkedin: string
  hook_video: string
  carrusel: string
}

export type IdeaTipo =
  | 'contrarian'
  | 'mental_framework'
  | 'uncomfortable_truth'
  | 'data_shock'
  | 'prediction'
  | 'confession'
  | 'system_critique'

export interface ViralIdea {
  tema: string
  idea_central: string
  tipo: IdeaTipo
  angulo_conflicto: string
  potencial_viral: number
  formatos: IdeaFormats
}

export interface IdeasResult {
  ideas: ViralIdea[]
  error?: string
}

export async function extractIdeas(
  transcripcion: string,
  resumenContexto: string = ''
): Promise<IdeasResult> {
  const authHeaders = await getAuthHeaders()

  const res = await fetch('/api/extraer-ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      transcripcion,
      resumen_contexto: resumenContexto,
    }),
  })

  if (res.status === 403) {
    const data = await res.json()
    throw new Error(data.error || 'UPGRADE_REQUIRED')
  }

  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Error ${res.status}`)
  }

  return res.json()
}


// ─── FASE 2: GENERAR COPY ───

export async function generateCopy(
  clip: Clip,
  transcripcion: string,
  resumenContexto: string
): Promise<CopyResult> {
  const authHeaders = await getAuthHeaders()

  const res = await fetch('/api/generar-copy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      clip,
      transcripcion,
      resumen_contexto: resumenContexto,
    }),
  })

  if (res.status === 429) {
    const data = await res.json()
    throw new Error(data.needs_login
      ? '🔒 Límite alcanzado. Regístrate para más.'
      : data.error || 'Límite de regeneraciones alcanzado'
    )
  }

  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Error ${res.status}`)
  }

  return res.json()
}

// ─── CRÉDITOS ───

export interface CreditsInfo {
  remaining: number
  plan: string
  unlimited: boolean
}

export async function fetchCredits(): Promise<CreditsInfo> {
  try {
    const authHeaders = await getAuthHeaders()
    const res = await fetch('/api/creditos', { headers: authHeaders })
    if (!res.ok) {
      return { remaining: 0, plan: 'FREE', unlimited: false }
    }
    return res.json()
  } catch {
    return { remaining: 0, plan: 'FREE', unlimited: false }
  }
}
