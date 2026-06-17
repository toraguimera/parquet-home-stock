import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

export default function Movimientos() {
  const [movimientos, setMovimientos] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ prod_id: '', tipo: 'entrada', cantidad: 1, ref: '', notas: '', fecha: new Date().toISOString().slice(0,10) })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [m, p] = await Promise.all([
      supabase.from('movimientos').select('*, productos(nombre,cat,stock,unidad)').order('created_at', { ascending: false }).limit(100),
      supabase.from('productos').select('id,nombre,stock,unidad').order('nombre')
    ])
    setMovimientos(m.data || [])
    setProductos(p.data || [])
    if (p.data?.length > 0) setForm(f => ({ ...f, prod_id: p.data[0].id }))
    setLoading(false)
  }

  const filtered = movimientos.filter(m => {
    if (tipoFilter && m.tipo !== tipoFilter) return false
    if (search && !m.productos?.nombre.toLowerCase().includes(search.toLowerCase()) && !m.ref?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-ES') : '—'

  async function registrar() {
    if (!form.prod_id || !form.cantidad) return
    setSaving(true)
    const prod = productos.find(p => p.id === +form.prod_id)
    if (!prod) return
    if (form.tipo === 'salida' && form.cantidad > prod.stock) {
      alert('Stock insuficiente: solo hay ' + prod.stock + ' ' + prod.unidad)
      setSaving(false)
      return
    }
    const newStock = form.tipo === 'entrada' ? prod.stock + +form.cantidad : prod.stock - +form.cantidad
    await supabase.from('productos').update({ stock: newStock }).eq('id', form.prod_id)
    await supabase.from('movimientos').insert([{ ...form, prod_id: +form.prod_id, cantidad: +form.cantidad }])
    setSaving(false)
    setModal(false)
    load()
  }

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Cargando...</div>

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Movimientos</div><div className="page-sub">Entradas y salidas de inventario</div></div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>+ Registrar</button>
      </div>
      <div className="filter-bar">
        <input style={{width:200}} placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} />
        <select style={{width:150}} value={tipoFilter} onChange={e=>setTipoFilter(e.target.value)}>
          <option value="">Todos</option>
          <option value="entrada">Entradas</option>
          <option value="salida">Salidas</option>
        </select>
        <span style={{color:'#888',fontSize:12}}>{filtered.length} registros</span>
      </div>
      <div className="card" style={{padding:0}}>
        <table className="tbl">
          <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Referencia</th><th>Notas</th></tr></thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.id}>
                <td style={{color:'#888',fontSize:12}}>{fmtDate(m.fecha)}</td>
                <td><div style={{fontWeight:500}}>{m.productos?.nombre||'—'}</div><div style={{fontSize:11,color:'#888'}}>{m.productos?.cat}</div></td>
                <td><span className={`badge badge-${m.tipo==='entrada'?'ok':'warn'}`}>{m.tipo}</span></td>
                <td style={{fontWeight:600,color:m.tipo==='entrada'?'#2e7d32':'#f57f17'}}>{m.tipo==='entrada'?'+':'−'}{m.cantidad}</td>
                <td style={{fontSize:12}}>{m.ref||'—'}</td>
                <td style={{fontSize:12,color:'#888'}}>{m.notas||'—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state">Sin movimientos</div>}
      </div>
      {modal && (
        <Modal title="Registrar movimiento" onClose={() => setModal(false)}>
          <div className="form-row c2">
            <div><label>Tipo</label><select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}><option value="entrada">Entrada</option><option value="salida">Salida</option></select></div>
            <div><label>Producto</label><select value={form.prod_id} onChange={e=>setForm({...form,prod_id:e.target.value})}>{productos.map(p=><option key={p.id} value={p.id}>{p.nombre} ({p.stock} {p.unidad})</option>)}</select></div>
          </div>
          <div className="form-row c3">
            <div><label>Cantidad</label><input type="number" min="1" value={form.cantidad} onChange={e=>setForm({...form,cantidad:e.target.value})} /></div>
            <div><label>Referencia</label><input value={form.ref} placeholder="Cliente / pedido" onChange={e=>setForm({...form,ref:e.target.value})} /></div>
            <div><label>Fecha</label><input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} /></div>
          </div>
          <div className="form-row"><div><label>Notas</label><textarea value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} /></div></div>
          <button className="btn btn-primary" onClick={registrar} disabled={saving}>{saving?'Guardando...':'✓ Registrar'}</button>
        </Modal>
      )}
    </div>
  )
}