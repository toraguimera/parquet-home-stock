import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const EMPTY = { num: '', proveedor: '', productos: '', fecha_pedido: new Date().toISOString().slice(0,10), fecha_entrega: '', estado: 'pendiente', total: 0, notas: '' }

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('pedidos').select('*').order('created_at', { ascending: false })
    setPedidos(data || [])
    setLoading(false)
  }

  const filtered = pedidos.filter(p => filtro === 'todos' || p.estado === filtro)
  const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-ES') : '—'

  async function save() {
    setSaving(true)
    const num = form.num || `PED-${String(pedidos.length+1).padStart(3,'0')}`
    await supabase.from('pedidos').insert([{ ...form, num }])
    if (form.fecha_entrega) {
      await supabase.from('eventos').insert([{ fecha: form.fecha_entrega, titulo: `Entrega ${num}`, tipo: 'entrega', notas: form.proveedor }])
    }
    setSaving(false)
    setModal(false)
    setForm(EMPTY)
    load()
  }

  async function avanzar(p) {
    const next = p.estado === 'pendiente' ? 'en_camino' : 'recibido'
    await supabase.from('pedidos').update({ estado: next }).eq('id', p.id)
    load()
  }

  async function del(id) {
    if (!confirm('¿Eliminar pedido?')) return
    await supabase.from('pedidos').delete().eq('id', id)
    load()
  }

  const estadoLabel = { pendiente: 'Pendiente', en_camino: 'En camino', recibido: 'Recibido' }
  const estadoCls = { pendiente: 'gray', en_camino: 'info', recibido: 'ok' }

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Cargando...</div>

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Pedidos a proveedor</div><div className="page-sub">Control de pedidos y recepciones</div></div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>+ Nuevo pedido</button>
      </div>
      <div className="tab-bar">
        {['todos','pendiente','en_camino','recibido'].map(f => (
          <button key={f} className={`tab-btn ${filtro===f?'active':''}`} onClick={() => setFiltro(f)}>
            {f==='todos'?'Todos':estadoLabel[f]}
            {f!=='todos' && <span style={{marginLeft:4,fontSize:11,color:'#888'}}>({pedidos.filter(p=>p.estado===f).length})</span>}
          </button>
        ))}
      </div>
      <div className="card" style={{padding:0}}>
        <table className="tbl">
          <thead><tr><th>Nº pedido</th><th>Proveedor</th><th>Productos</th><th>Pedido</th><th>Entrega</th><th>Estado</th><th>Total</th><th></th></tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td style={{fontWeight:600}}>{p.num}</td>
                <td>{p.proveedor}</td>
                <td style={{fontSize:12,maxWidth:150}}>{p.productos}</td>
                <td style={{fontSize:12,color:'#888'}}>{fmtDate(p.fecha_pedido)}</td>
                <td style={{fontSize:12}}>{fmtDate(p.fecha_entrega)}</td>
                <td><span className={`badge badge-${estadoCls[p.estado]}`}>{estadoLabel[p.estado]}</span></td>
                <td style={{fontWeight:600}}>{p.total?p.total+'€':'—'}</td>
                <td>
                  <div style={{display:'flex',gap:4}}>
                    {p.estado !== 'recibido' && <button className="btn btn-sm" onClick={() => avanzar(p)}>→</button>}
                    <button className="btn btn-sm btn-danger" onClick={() => del(p.id)}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state">Sin pedidos</div>}
      </div>
      {modal && (
        <Modal title="Nuevo pedido" onClose={() => setModal(false)}>
          <div className="form-row c2">
            <div><label>Nº pedido</label><input value={form.num} placeholder="Auto" onChange={e=>setForm({...form,num:e.target.value})} /></div>
            <div><label>Proveedor</label><input value={form.proveedor} onChange={e=>setForm({...form,proveedor:e.target.value})} /></div>
          </div>
          <div className="form-row"><div><label>Productos</label><input value={form.productos} placeholder="Ej: Puertas lacadas x20" onChange={e=>setForm({...form,productos:e.target.value})} /></div></div>
          <div className="form-row c3">
            <div><label>Fecha pedido</label><input type="date" value={form.fecha_pedido} onChange={e=>setForm({...form,fecha_pedido:e.target.value})} /></div>
            <div><label>Entrega estimada</label><input type="date" value={form.fecha_entrega} onChange={e=>setForm({...form,fecha_entrega:e.target.value})} /></div>
            <div><label>Total €</label><input type="number" value={form.total} onChange={e=>setForm({...form,total:+e.target.value})} /></div>
          </div>
          <div className="form-row"><div><label>Notas</label><textarea value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} /></div></div>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Guardando...':'✓ Crear pedido'}</button>
        </Modal>
      )}
    </div>
  )
}