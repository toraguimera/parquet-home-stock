import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const CHIPS = ['Que productos debo pedir urgentemente','Dame un analisis del inventario','Que instalaciones tengo pendientes']

export default function Asistente() {
    const [msgs, setMsgs] = useState([{ role: 'ai', text: 'Hola, soy el asistente de Parquet Home. En que te ayudo?' }])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [context, setContext] = useState(null)
    const msgsRef = useRef(null)

  useEffect(() => { loadContext() }, [])
    useEffect(() => { if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight }, [msgs])

  async function loadContext() {
        const [p, ped, c] = await Promise.all([
                supabase.from('productos').select('*'),
                supabase.from('pedidos').select('*').neq('estado', 'recibido'),
                supabase.from('clientes').select('*').in('estado', ['activo','presupuesto']),
              ])
        setContext({ productos: p.data||[], pedidos: ped.data||[], clientes: c.data||[] })
  }

  async function send(msg) {
        if (!msg.trim() || loading) return
        const userMsg = msg.trim()
        setInput('')
        setMsgs(m => [...m, { role: 'user', text: userMsg }])
        setLoading(true)
        try {
                const res = await fetch('/api/chat', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                                      max_tokens: 800,
                                      messages: [{ role: 'user', content: userMsg }]
                          })
                })
                const data = await res.json()
                const texto = data.content?.[0]?.text
                  || (data.error ? 'Error: ' + data.error : 'Sin respuesta.')
                setMsgs(m => [...m, { role: 'ai', text: texto }])
        } catch(err) {
                setMsgs(m => [...m, { role: 'ai', text: 'Error de red: ' + err.message }])
        }
        setLoading(false)
  }

  return (
        <div>
              <div className="page-header">
                      <div><div className="page-title">Asistente IA</div>div><div className="page-sub">Analisis inteligente del negocio</div>div></div>div>
                      <button className="btn btn-sm" onClick={loadContext}>Actualizar</button>button>
              </div>div>
              <div className="card">
                      <div className="ai-msgs" ref={msgsRef}>
                        {msgs.map((m,i) => <div key={i} className={'msg ' + m.role}>{m.text}</div>div>)}
                        {loading && <div className="msg ai loading">...</div>div>}
                      </div>div>
                      <div className="ai-chips">
                        {CHIPS.map(c => <button key={c} className="chip" onClick={() => send(c)}>{c}</button>button>)}
                      </div>div>
                      <div className="ai-input">
                                <input
                                              value={input}
                                              onChange={e => setInput(e.target.value)}
                                              onKeyDown={e => e.key === 'Enter' && send(input)}
                                              placeholder="Pregunta algo sobre el negocio..."
                                              disabled={loading}
                                            />
                                <button onClick={() => send(input)} disabled={loading || !input.trim()}>Enviar</button>button>
                      </div>div>
              </div>div>
        </div>div>
      )
}</div>
