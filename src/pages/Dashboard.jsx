import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard({ onNavigate }) {
  const [productos, setProductos] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [clientes, setClientes] = useState([])
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [p, m, ped, c, e] = await Promise.all([
      supabase.from('productos').select('*'),
      supabase.from('movimientos').select('*, productos(nombre)').order('created_at', { ascending: false }).limit(5),
      supabase.from('pedidos').select('*').neq('estado', 'recibido'),
      supabase.from('clientes').select('*').eq('estado', 'activo'),
      supabase.from('eventos').select('*').gte('fecha', new Date().toISOString().slice(0,10)).order('fecha').limit(5),
    ])
    setProductos(p.data || [])
    setMovimientos(m.data || [])
    setPedidos(ped.data || [])
    setClientes(c.data || [])
    setEventos(e.data || [])
    setLoading(false)
  }

  const bajos = productos.filter(p => p.stock <= p.min)
  const sinStock = productos.filter(p => p.stock === 0)
  const valorTotal = productos.reduce((a, p) => a + (p.stock * (p.coste || 0)), 0)
  const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '—'
  function getStatus(p) {
    if (p.stock === 0) return { label: 'Sin stock', cls: 'crit' }
    if (p.stock <= p.min) return { label: 'Bajo mínimo', cls: 'warn' }
    return { label: 'OK', cls: 'ok' }
  }

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Cargando...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => onNavigate('asistente')}>🤖 Consultar IA</button>
      </div>
      <div className="metrics">
        <div className="metric"><div className="metric-label">Productos</div><div className="metric-value">{productos.length}</div><div className="metric-sub">{productos.reduce((a,p)=>a+p.stock,0)} uds</div></div>
        <div className="metric"><div className="metric-label">Bajo mínimo</div><div className="metric-value" style={{color:bajos.length?'#f57f17':'#2e7d32'}}>{bajos.length}</div></div>
        <div className="metric"><div className="metric-label">Sin stock</div><div className="metric-value" style={{color:sinStock.length?'#c62828':'#2e7d32'}}>{sinStock.length}</div></div>
        <div className="metric"><div className="metric-label">Pedidos activos</div><div className="metric-value" style={{color:'#1565c0'}}>{pedidos.length}</div></div>
        <div className="metric"><div className="metric-label">Clientes activos</div><div className="metric-value">{clientes.length}</div></div>
        <div className="metric"><div className="metric-label">Valor inventario</div><div className="metric-value" style={{fontSize:'18px'}}>{valorTotal.toLocaleString('es-ES')}€</div></div>
      </div>
      <div className="grid2">
        <div className="card">
          <div className="card-title">Alertas de stock {bajos.length > 0 && <span className="badge badge-warn">{bajos.length}</span>}</div>
          {bajos.length === 0 ? <div className="empty-state">✅ Sin alertas</div> : bajos.slice(0,5).map(p => {
            const st = getStatus(p)
            return <div key={p.id} className="alert-item"><span>{p.stock===0?'🔴':'🟡'}</span><div className="alert-item-name"><strong>{p.nombre}</strong><span>{p.cat}</span></div><span className={`badge badge-${st.cls}`}>{p.stock} {p.unidad}</span></div>
          })}
        </div>
        <div className="card">
          <div className="card-title">Pedidos pendientes {pedidos.length > 0 && <span className="badge badge-info">{pedidos.length}</span>}</div>
          {pedidos.length === 0 ? <div className="empty-state">✅ Sin pedidos</div> : pedidos.slice(0,4).map(p => (
            <div key={p.id} className="alert-item"><span>🚚</span><div className="alert-item-name"><strong>{p.num} — {p.proveedor}</strong><span>Entrega: {fmtDate(p.fecha_entrega)}</span></div><span className={`badge badge-${p.estado==='en_camino'?'info':'gray'}`}>{p.estado==='en_camino'?'En camino':'Pendiente'}</span></div>
          ))}
        </div>
      </div>
      <div className="grid2">
        <div className="card">
          <div className="card-title">Movimientos recientes</div>
          {movimientos.length === 0 ? <div className="empty-state">Sin movimientos</div> : movimientos.map(m => (
            <div key={m.id} className="alert-item"><span>{m.tipo==='entrada'?'🟢':'🟠'}</span><div className="alert-item-name"><strong>{m.productos?.nombre||'—'}</strong><span>{fmtDate(m.fecha)} · {m.ref||'—'}</span></div><span style={{fontWeight:600,color:m.tipo==='entrada'?'#2e7d32':'#f57f17'}}>{m.tipo==='entrada'?'+':'−'}{m.cantidad}</span></div>
          ))}
        </div>
        <div className="card">
          <div className="card-title">Próximos eventos</div>
          {eventos.length === 0 ? <div className="empty-state">Sin eventos</div> : eventos.map(e => (
            <div key={e.id} className="alert-item"><span>{e.tipo==='entrega'?'📦':e.tipo==='pedido'?'🚚':'🔧'}</span><div className="alert-item-name"><strong>{e.titulo}</strong><span>{fmtDate(e.fecha)}{e.notas?' · '+e.notas:''}</span></div><span className={`badge badge-${e.tipo==='entrega'?'ok':e.tipo==='pedido'?'info':'warn'}`}>{e.tipo}</span></div>
          ))}
        </div>
      </div>
    </div>
  )
}