"use client"

/**
 * Extracts the YouTube video ID from various URL formats
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/embed/, youtube.com/v/
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null

  // Clean up the URL
  const cleanUrl = url.trim()

  // Pattern 1: youtu.be/VIDEO_ID
  const shortUrlMatch = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (shortUrlMatch) return shortUrlMatch[1]

  // Pattern 2: youtube.com/watch?v=VIDEO_ID
  const watchMatch = cleanUrl.match(/youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/)
  if (watchMatch) return watchMatch[1]

  // Pattern 3: youtube.com/embed/VIDEO_ID
  const embedMatch = cleanUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
  if (embedMatch) return embedMatch[1]

  // Pattern 4: youtube.com/v/VIDEO_ID
  const vMatch = cleanUrl.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/)
  if (vMatch) return vMatch[1]

  // Pattern 5: Just the video ID itself (11 characters)
  const idOnlyMatch = cleanUrl.match(/^([a-zA-Z0-9_-]{11})$/)
  if (idOnlyMatch) return idOnlyMatch[1]

  return null
}

/**
 * Converts a timestamp string (HH:MM:SS or MM:SS) to seconds
 */
export function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':').map(Number)
  
  if (parts.length === 3) {
    // HH:MM:SS format
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  } else if (parts.length === 2) {
    // MM:SS format
    return parts[0] * 60 + parts[1]
  }
  
  return 0
}

/**
 * Generates a YouTube embed URL with start and end times
 */
export function getYouTubeEmbedUrl(
  videoIdOrUrl: string,
  startTime?: string,
  endTime?: string,
  loop?: boolean
): string | null {
  const videoId = extractYouTubeVideoId(videoIdOrUrl) || videoIdOrUrl
  
  if (!videoId || videoId.length !== 11) return null

  const params = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    modestbranding: '1',
  })

  if (startTime) {
    params.set('start', timestampToSeconds(startTime).toString())
  }

  if (endTime) {
    params.set('end', timestampToSeconds(endTime).toString())
  }

  if (loop) {
    params.set('loop', '1')
    params.set('playlist', videoId)
  }

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

/**
 * Formats seconds into a readable duration string
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
