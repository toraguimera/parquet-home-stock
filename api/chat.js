import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-haiku-4-5'

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' })

  if (!ANTHROPIC_API_KEY) {
        console.error('[chat] ANTHROPIC_API_KEY no esta configurada en las variables de entorno')
        return res.status(500).json({ error: 'Configuracion del servidor incompleta: falta ANTHROPIC_API_KEY' })
  }

  const { messages, max_tokens = 1000 } = req.body || {}
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'El campo messages es obligatorio y debe ser un array' })
      }

  try {
        let inventarioTexto = 'No se pudo cargar el inventario.'
        let alertasTexto = ''

      if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
              const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
              const { data: productos, error: sbError } = await supabase
                .from('productos')
                .select('id, nombre, cat, stock, min, max, coste, unidad')

          if (sbError) {
                    console.error('[chat] Error al leer productos de Supabase:', sbError.message)
          } else if (productos && productos.length > 0) {
                    inventarioTexto = productos
                      .map(p =>
                                    `- ${p.nombre} (${p.cat}): stock ${p.stock} ${p.unidad} | min ${p.min} | max ${p.max} | coste ${p.coste}EUR`
                                     )
                      .join('\n')

                const bajoMinimo = productos.filter(p => p.stock !== null && p.min !== null && p.stock < p.min)
                    if (bajoMinimo.length > 0) {
                                alertasTexto = '\n\nALERTAS - Productos con stock por debajo del minimo:\n' +
                                              bajoMinimo.map(p =>
                                                              `[ALERTA] ${p.nombre}: stock actual ${p.stock} ${p.unidad} (minimo: ${p.min})`
                                                                         ).join('\n')
                    }
          }
      } else {
              console.warn('[chat] SUPABASE_URL o SUPABASE_SERVICE_KEY no configuradas; se omite el inventario.')
      }

      const systemPrompt =
              `Eres el asistente de Parquet Home, empresa de parquet y puertas en Barcelona. Respondes siempre en espanol, de forma concisa y util.\n\n` +
              `INVENTARIO ACTUAL:\n${inventarioTexto}` +
              alertasTexto

      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': ANTHROPIC_API_KEY,
                        'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                        model: MODEL,
                        max_tokens,
                        system: systemPrompt,
                        messages
              })
      })

      const data = await anthropicRes.json()

      if (!anthropicRes.ok) {
              console.error('[chat] Error de la API de Anthropic:', JSON.stringify(data))
              return res.status(anthropicRes.status).json({
                        error: data?.error?.message || `Error de Anthropic (${anthropicRes.status})`,
                        detail: data
              })
      }

      return res.status(200).json(data)

  } catch (err) {
        console.error('[chat] Excepcion no controlada:', err)
        return res.status(500).json({ error: 'Error interno del servidor: ' + err.message })
  }
}
