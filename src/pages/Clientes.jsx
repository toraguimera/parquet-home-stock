import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const EMPTY = { nombre: '', tel: '', servicio: '', fecha: new Date().toISOString().slice(0,10), importe: 0, estado: 'presupuesto', notas: '' }

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('clientes').select('*').order('created_at', { ascending: false })
    setClientes(data || [])
    setLoading(false)
  }

  const filtered = clientes.filter(c => {
    if (estadoFilter && c.estado !== estadoFilter) return false
    if (search && !c.nombre.toLowerCase().includes(search.toLowerCase()) && !c.servicio?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-ES') : '—'

  async function save() {
    setSaving(true)
    await supabase.from('clientes').insert([form])
    setSaving(false)
    setModal(false)
    setForm(EMPTY)
    load()
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('clientes').update({ estado }).eq('id', id)
    load()
  }

  async function del(id) {
    if (!confirm('¿Eliminar cliente?')) return
    await supabase.from('clientes').delete().eq('id', id)
    load()
  }

  const estadoCls = { presupuesto: 'gray', activo: 'info', completado: 'ok' }

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Cargando...</div>

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Clientes e instalaciones</div><div className="page-sub">Historial de trabajos</div></div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>+ Nuevo cliente</button>
      </div>
      <div className="filter-bar">
        <input style={{width:200}} placeholder="Buscar cliente..." value={search} onChange={e=>setSearch(e.target.value)} />
        <select style={{width:150}} value={estadoFilter} onChange={e=>setEstadoFilter(e.target.value)}>
          <option value="">Todos</option>
          <option value="presupuesto">Presupuesto</option>
          <option value="activo">Activo</option>
          <option value="completado">Completado</option>
        </select>
      </div>
      <div className="card" style={{padding:0}}>
        <table className="tbl">
          <thead><tr><th>Cliente</th><th>Teléfono</th><th>Servicio</th><th>Fecha</th><th>Importe</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td><div style={{fontWeight:500}}>{c.nombre}</div>{c.notas&&<div style={{fontSize:11,color:'#888'}}>{c.notas}</div>}</td>
                <td style={{fontSize:13}}>{c.tel||'—'}</td>
                <td style={{fontSize:12,maxWidth:160}}>{c.servicio||'—'}</td>
                <td style={{fontSize:12,color:'#888'}}>{fmtDate(c.fecha)}</td>
                <td style={{fontWeight:600}}>{c.importe?c.importe.toLocaleString('es-ES')+'€':'Pendiente'}</td>
                <td>
                  <select className={`badge badge-${estadoCls[c.estado]}`} style={{border:'none',background:'none',cursor:'pointer',fontWeight:600,fontSize:11}} value={c.estado} onChange={e=>cambiarEstado(c.id,e.target.value)}>
                    <option value="presupuesto">Presupuesto</option>
                    <option value="activo">Activo</option>
                    <option value="completado">Completado</option>
                  </select>
                </td>
                <td><button className="btn btn-sm btn-danger" onClick={()=>del(c.id)}>🗑</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state">Sin clientes</div>}
      </div>
      {modal && (
        <Modal title="Nuevo cliente" onClose={() => setModal(false)}>
          <div className="form-row c2">
            <div><label>Nombre</label><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} /></div>
            <div><label>Teléfono</label><input value={form.tel} onChange={e=>setForm({...form,tel:e.target.value})} /></div>
          </div>
          <div className="form-row"><div><label>Servicio</label><input value={form.servicio} placeholder="Ej: Instalación parquet 60m² + 3 puertas" onChange={e=>setForm({...form,servicio:e.target.value})} /></div></div>
          <div className="form-row c3">
            <div><label>Fecha</label><input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} /></div>
            <div><label>Importe €</label><input type="number" value={form.importe} onChange={e=>setForm({...form,importe:+e.target.value})} /></div>
            <div><label>Estado</label><select value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}><option value="presupuesto">Presupuesto</option><option value="activo">Activo</option><option value="completado">Completado</option></select></div>
          </div>
          <div className="form-row"><div><label>Notas</label><textarea value={form.notas} placeholder="Dirección, detalles..." onChange={e=>setForm({...form,notas:e.target.value})} /></div></div>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Guardando...':'✓ Añadir'}</button>
        </Modal>
      )}
    </div>
  )
}