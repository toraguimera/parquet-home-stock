import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const CHIPS = [
  '¿Qué productos debo pedir urgentemente?',
  'Dame un análisis completo del inventario',
  'Redacta un email al proveedor para reponer stock bajo mínimo',
  '¿Qué productos se mueven más?',
  'Resume la actividad de esta semana',
  '¿Qué instalaciones tengo pendientes?',
]

export default function Asistente() {
  const [msgs, setMsgs] = useState([{ role: 'ai', text: 'Hola, soy el asistente de Parquet Home. ¿En qué te ayudo?' }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState(null)
  const msgsRef = useRef(null)

  useEffect(() => { loadContext() }, [])
  useEffect(() => { if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight }, [msgs])

  async function loadContext() {
    const [p, ped, c, e] = await Promise.all([
      supabase.from('productos').select('*'),
      supabase.from('pedidos').select('*').neq('estado', 'recibido'),
      supabase.from('clientes').select('*').in('estado', ['activo','presupuesto']),
      supabase.from('eventos').select('*').gte('fecha', new Date().toISOString().slice(0,10)).order('fecha').limit(10),
    ])
    setContext({ productos: p.data||[], pedidos: ped.data||[], clientes: c.data||[], eventos: e.data||[] })
  }

  function getStatus(p) {
    if (p.stock === 0) return 'Sin stock'
    if (p.stock <= p.min) return 'Bajo mínimo'
    return 'OK'
  }

  async function send(msg) {
    if (!msg.trim() || loading) return
    const userMsg = msg.trim()
    setInput('')
    setMsgs(m => [...m, { role: 'user', text: userMsg }])
    setLoading(true)
    const bajos = context?.productos.filter(p => p.stock <= p.min) || []
    const sys = 'Eres el asistente de Parquet Home, empresa de parquet y puertas en Barcelona. Hablas en español, eres conciso. Stock: ' + (context?.productos.map(p => p.nombre + ': ' + p.stock + p.unidad).join(', ') || 'sin datos')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, system: sys, messages: [{ role: 'user', content: userMsg }] })
cd ~/parquethome-stock && cat > src/pages/Asistente.jsx << 'ENDOFFILE'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const CHIPS = [
  '¿Qué productos debo pedir urgentemente?',
  'Dame un análisis completo del inventario',
  'Redacta un email al proveedor para reponer stock bajo mínimo',
  '¿Qué productos se mueven más?',
  'Resume la actividad de esta semana',
  '¿Qué instalaciones tengo pendientes?',
]

export default function Asistente() {
  const [msgs, setMsgs] = useState([{ role: 'ai', text: 'Hola, soy el asistente de Parquet Home. ¿En qué te ayudo?' }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState(null)
  const msgsRef = useRef(null)

  useEffect(() => { loadContext() }, [])
  useEffect(() => { if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight }, [msgs])

  async function loadContext() {
    const [p, ped, c, e] = await Promise.all([
      supabase.from('productos').select('*'),
      supabase.from('pedidos').select('*').neq('estado', 'recibido'),
      supabase.from('clientes').select('*').in('estado', ['activo','presupuesto']),
      supabase.from('eventos').select('*').gte('fecha', new Date().toISOString().slice(0,10)).order('fecha').limit(10),
    ])
    setContext({ productos: p.data||[], pedidos: ped.data||[], clientes: c.data||[], eventos: e.data||[] })
  }

  function getStatus(p) {
    if (p.stock === 0) return 'Sin stock'
    if (p.stock <= p.min) return 'Bajo mínimo'
    return 'OK'
  }

  async function send(msg) {
    if (!msg.trim() || loading) return
    const userMsg = msg.trim()
    setInput('')
    setMsgs(m => [...m, { role: 'user', text: userMsg }])
    setLoading(true)
    const bajos = context?.productos.filter(p => p.stock <= p.min) || []
    const sys = 'Eres el asistente de Parquet Home, empresa de parquet y puertas en Barcelona. Hablas en español, eres conciso. Stock: ' + (context?.productos.map(p => p.nombre + ': ' + p.stock + p.unidad).join(', ') || 'sin datos')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, system: sys, messages: [{ role: 'user', content: userMsg }] })
      })
      const data = await res.json()
      setMsgs(m => [...m, { role: 'ai', text: data.content?.[0]?.text || 'Sin respuesta.' }])
    } catch(err) {
      setMsgs(m => [...m, { role: 'ai', text: 'Error: ' + err.message }])
    }
    setLoading(false)
  }

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Asistente IA</div><div className="page-sub">Análisis inteligente del negocio</div></div>
        <button className="btn btn-sm" onClick={loadContext}>Actualizar datos</button>
      </div>
      <div className="card">
        <div className="ai-msgs" ref={msgsRef}>
          {msgs.map((m,i) => <div key={i} className={'msg ' + m.role}>{m.text}</div>)}
          {loading && <div className="msg loading">Analizando...</div>}
        </div>
        <div className="ai-input-row">
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send(input)} placeholder="Escribe tu consulta..." disabled={loading} />
          <button className="btn btn-primary" onClick={()=>send(input)} disabled={loading||!input.trim()}>Enviar</button>
        </div>
        <div className="chip-row">
          {CHIPS.map(c=><button key={c} className="chip" onClick={()=>send(c)} disabled={loading}>{c}</button>)}
        </div>
      </div>
    </div>
  )
}
