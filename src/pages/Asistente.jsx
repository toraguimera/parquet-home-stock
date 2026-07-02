import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const CHIPS = ['Qué productos debo pedir urgentemente','Dame un análisis del inventario','Qué instalaciones tengo pendientes']

export default function Asistente() {
const [msgs, setMsgs] = useState([{ role: 'ai', text: 'Hola, soy el asistente de Parquet Home. En qué te ayudo?' }])
const [input, setInput] = useState('')
const [loading, setLoading] = useState(false)
const [context, setContext] = useState(null)
const [pending, setPending] = useState(null)
const [applying, setApplying] = useState(false)
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

function parseAction(txt) {
try {
const m = txt.match(/\{[^{}]*"accion"\s*:\s*"stock"[^{}]*\}/)
if (!m) return null
const obj = JSON.parse(m[0])
return obj.accion === 'stock' ? obj : null
} catch { return null }
}

async function send(msg) {
if (!msg.trim() || loading) return
const userMsg = msg.trim()
setInput('')
setMsgs(m => [...m, { role: 'user', text: userMsg }])
setLoading(true)
const lista = context?.productos.map(p => '[id ' + p.id + '] ' + p.nombre + ': ' + p.stock + ' ' + p.unidad + ' (min:' + p.min + ', ubicacion: ' + (p.ubicacion || 'sin ubicacion') + ')').join(', ') || 'sin datos'
const sys = 'Eres el asistente de Parquet Home, empresa de parquet y puertas en Barcelona. Hablas en español. Cuando te pregunten dónde está o dónde se encuentra un producto, indica su ubicación en el almacén (por ejemplo "Estantería 13 · Piso 2" o "Suelo"). '
+ 'Si el usuario te pide MODIFICAR el stock de un producto (una venta o salida, una entrada, o fijar una cantidad exacta), NO respondas con texto: responde ÚNICAMENTE con un objeto JSON en una sola línea, sin ningún texto adicional, con este formato exacto: {"accion":"stock","id":ID,"op":"restar","cantidad":N}. Usa "restar" para ventas o salidas ("han salido 3 de..."), "sumar" para entradas ("han entrado 10 de..."), y "fijar" para establecer una cantidad exacta ("pon la lisa 60,5 en 15"). El campo id debe ser el número de id del producto tal como aparece en la lista. El campo cantidad es el número de unidades (para "fijar" es la cantidad final deseada). Para cualquier otra consulta (preguntas, ubicaciones, análisis), responde normalmente en texto y NO uses JSON. '
+ 'Stock actual: ' + lista
try {
const res = await fetch('/api/chat', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 800, system: sys, messages: [{ role: 'user', content: userMsg }] })
})
const data = await res.json()
const txt = data.content?.[0]?.text || 'Sin respuesta.'
const action = parseAction(txt)
if (action) proposeAction(action, userMsg)
else setMsgs(m => [...m, { role: 'ai', text: txt }])
} catch(err) {
setMsgs(m => [...m, { role: 'ai', text: 'Error: ' + err.message }])
}
setLoading(false)
}

function proposeAction(action, userMsg) {
const prod = context?.productos.find(p => p.id === +action.id)
if (!prod) { setMsgs(m => [...m, { role: 'ai', text: 'No he encontrado ese producto. ¿Puedes decirme el nombre exacto?' }]); return }
const cant = +action.cantidad
if (!(cant >= 0) || (action.op !== 'fijar' && cant === 0)) { setMsgs(m => [...m, { role: 'ai', text: 'No he entendido la cantidad. ¿Puedes repetirlo?' }]); return }
let nuevo
if (action.op === 'restar') nuevo = prod.stock - cant
else if (action.op === 'sumar') nuevo = prod.stock + cant
else if (action.op === 'fijar') nuevo = cant
else { setMsgs(m => [...m, { role: 'ai', text: 'No he entendido la operación.' }]); return }
if (nuevo < 0) { setMsgs(m => [...m, { role: 'ai', text: 'No puedo dejar el stock en negativo: ' + prod.nombre + ' tiene ' + prod.stock + ' ' + prod.unidad + ' y me pides sacar ' + cant + '.' }]); return }
const verbo = action.op === 'restar' ? 'Salida de ' + cant : action.op === 'sumar' ? 'Entrada de ' + cant : 'Fijar a ' + cant
setMsgs(m => [...m, { role: 'ai', text: verbo + ' · ' + prod.nombre + ': ' + prod.stock + ' → ' + nuevo + ' ' + prod.unidad + '. ¿Lo confirmo?' }])
setPending({ id: prod.id, nombre: prod.nombre, unidad: prod.unidad, actual: prod.stock, nuevo, userMsg })
}

async function confirmAction() {
if (!pending || applying) return
setApplying(true)
const { id, nombre, unidad, actual, nuevo, userMsg } = pending
await supabase.from('productos').update({ stock: nuevo }).eq('id', id)
const delta = nuevo - actual
if (delta !== 0) {
const tipo = delta > 0 ? 'entrada' : 'salida'
await supabase.from('movimientos').insert([{ prod_id: id, tipo, cantidad: Math.abs(delta), ref: 'Asistente IA', notas: userMsg, fecha: new Date().toISOString().slice(0,10) }])
}
setApplying(false)
setPending(null)
setMsgs(m => [...m, { role: 'ai', text: '✅ Hecho. ' + nombre + ': ' + actual + ' → ' + nuevo + ' ' + unidad + '.' }])
loadContext()
}

function cancelAction() {
setPending(null)
setMsgs(m => [...m, { role: 'ai', text: 'Cancelado, no he cambiado nada.' }])
}

return (
<div>
<div className="page-header">
<div><div className="page-title">Asistente IA</div><div className="page-sub">Análisis inteligente del negocio</div></div>
<button className="btn btn-sm" onClick={loadContext}>Actualizar</button>
</div>
<div className="card">
<div className="ai-msgs" ref={msgsRef}>
{msgs.map((m,i) => <div key={i} className={'msg ' + m.role}>{m.text}</div>)}
{loading && <div className="msg loading">Analizando...</div>}
{pending && (
<div style={{display:'flex',gap:8,marginTop:8}}>
<button className="btn btn-primary btn-sm" onClick={confirmAction} disabled={applying}>{applying?'Guardando...':'✓ Confirmar'}</button>
<button className="btn btn-sm" onClick={cancelAction} disabled={applying}>Cancelar</button>
</div>
)}
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
