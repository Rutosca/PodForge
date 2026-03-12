/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    // En Docker: NEXT_PUBLIC_API_URL=http://web:5000 (nombre del servicio)
    // En local:  por defecto http://localhost:5000
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
      {
        // Los clips de vídeo generados por FFmpeg se sirven desde Flask /media/
        source: '/media/:path*',
        destination: `${apiUrl}/media/:path*`,
      },
    ]
  },
}

export default nextConfig
