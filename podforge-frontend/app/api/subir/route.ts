/**
 * Route Handler para subida de archivos.
 *
 * Por qué existe este fichero y no se usa el rewrite de next.config.mjs:
 * Next.js 15+ limita el body de los rewrites por defecto (la clave
 * `proxyClientMaxBodySize` que usábamos NO es válida y se ignora).
 * Este handler usa `runtime = 'nodejs'` y hace streaming del body directamente
 * a Flask sin buffering, eliminando cualquier límite de tamaño del proxy.
 */

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 min — tiempo suficiente para subir archivos grandes

export async function POST(req: NextRequest) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

  // Construir headers a reenviar: auth + content-type (con boundary) + content-length
  const headers = new Headers()

  const authorization = req.headers.get('authorization')
  if (authorization) headers.set('authorization', authorization)

  // Content-Type DEBE incluir el boundary multipart — no lo podemos cambiar
  const contentType = req.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)

  // Content-Length es necesario para que Flask pueda hacer el check de tamaño
  const contentLength = req.headers.get('content-length')
  if (contentLength) headers.set('content-length', contentLength)

  try {
    const response = await fetch(`${apiUrl}/subir`, {
      method: 'POST',
      headers,
      // req.body es un ReadableStream — lo pasamos sin bufferizar en memoria
      body: req.body,
      // 'duplex: half' es necesario en Node.js 18+ para streaming de request body
      // @ts-ignore — no está en los tipos estándar de fetch pero sí funciona
      duplex: 'half',
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('[/api/subir] Error al conectar con Flask:', error?.message)
    return NextResponse.json(
      { error: 'Error de conexión con el servidor. Inténtalo de nuevo.' },
      { status: 502 }
    )
  }
}
