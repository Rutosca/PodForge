import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

  const headers = new Headers()
  const authorization = req.headers.get('authorization')
  if (authorization) headers.set('authorization', authorization)

  try {
    const response = await fetch(`${apiUrl}/historial`, { headers })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('[/api/historial] Error al conectar con Flask:', error?.message)
    return NextResponse.json({ historial: [] }, { status: 502 })
  }
}
