import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const EMPTY = {
  prod_id: '',
  tipo: 'entrada',
  cantidad: '',
  ref: '',
  fecha: new Date().toISOString().slice(0, 10)
}

export default function Movimientos() {
  const [movimientos, setMovimientos] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [modal, setModal] = useState(null) // null | 'new' | 'edit'
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [editOriginal, setEditOriginal] = useState(null) // movimiento original para deshacer el stock

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: movs }, { data: prods }] = await Promise.all([
      supabase
        .from('movimientos')
        .select('*, productos(nombre, cat, stock, unidad)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('productos')
        .select('id, nombre, stock, unidad')
        .order('nombre')
    ])
    setMovimientos(movs || [])
    setProductos(prods || [])
    setLoading(false)
  }

  const filtered = movimientos.filter(m => {
    if (tipoFilter && m.tipo !== tipoFilter) return false
    if (search && !m.productos?.nombre?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function openNew() {
    const firstProd = productos[0]?.id || ''
    setForm({ ...EMPTY, prod_id: String(firstProd) })
    setEditOriginal(null)
    setModal('new')
  }

  function openEdit(m) {
    setForm({
      id: m.id,
      prod_id: String(m.prod_id),
      tipo: m.tipo,
      cantidad: String(m.cantidad),
      ref: m.ref || '',
      fecha: m.fecha || new Date().toISOString().slice(0, 10)
    })
    setEditOriginal(m)
    setModal('edit')
  }

  async function save() {
    if (!form.prod_id || !form.cantidad) return
    setSaving(true)

    const prod = productos.find(p => p.id === +form.prod_id)
    if (!prod) { setSaving(false); return }

    if (modal === 'new') {
      // Comprobar stock en salidas
      if (form.tipo === 'salida' && +form.cantidad > prod.stock) {
        alert(`Stock insuficiente: solo hay ${prod.stock} ${prod.unidad}`)
        setSaving(false)
        return
      }
      const newStock = form.tipo === 'entrada'
        ? prod.stock + +form.cantidad
        : prod.stock - +form.cantidad
      await supabase.from('productos').update({ stock: newStock }).eq('id', prod.id)
      await supabase.from('movimientos').insert([{
        prod_id: +form.prod_id,
        tipo: form.tipo,
        cantidad: +form.cantidad,
        ref: form.ref,
        fecha: form.fecha
      }])
    } else {
      // Edición: deshacer efecto antiguo y aplicar el nuevo
      const sameProd = editOriginal.prod_id === +form.prod_id

      if (sameProd) {
        // Mismo producto: deshacer + reaplicar
        const stockAfterUndo = editOriginal.tipo === 'entrada'
          ? prod.stock - editOriginal.cantidad
          : prod.stock + editOriginal.cantidad
        const newStock = form.tipo === 'entrada'
          ? stockAfterUndo + +form.cantidad
          : stockAfterUndo - +form.cantidad
        if (newStock < 0) {
          alert(`Stock insuficiente`)
          setSaving(false)
          return
        }
        await supabase.from('productos').update({ stock: newStock }).eq('id', prod.id)
      } else {
        // Producto distinto: deshacer en el producto antiguo, aplicar en el nuevo
        const oldProd = productos.find(p => p.id === editOriginal.prod_id)
        if (oldProd) {
          const undoneStock = editOriginal.tipo === 'entrada'
            ? oldProd.stock - editOriginal.cantidad
            : oldProd.stock + editOriginal.cantidad
          await supabase.from('productos').update({ stock: undoneStock }).eq('id', oldProd.id)
        }
        if (form.tipo === 'salida' && +form.cantidad > prod.stock) {
          alert(`Stock insuficiente: solo hay ${prod.stock} ${prod.unidad}`)
          setSaving(false)
          return
        }
        const newStock = form.tipo === 'entrada'
          ? prod.stock + +form.cantidad
          : prod.stock - +form.cantidad
        await supabase.from('productos').update({ stock: newStock }).eq('id', prod.id)
      }

      // Actualizar el registro del movimiento
      await supabase.from('movimientos').update({
        prod_id: +form.prod_id,
        tipo: form.tipo,
        cantidad: +form.cantidad,
        ref: form.ref,
        fecha: form.fecha
      }).eq('id', editOriginal.id)
    }

    setSaving(false)
    setModal(null)
    load()
  }

  async function del(m) {
    if (!confirm('¿Eliminar movimiento?')) return
    // Deshacer el efecto en el stock
    const prod = productos.find(p => p.id === m.prod_id)
    if (prod) {
      const newStock = m.tipo === 'entrada'
        ? prod.stock - m.cantidad
        : prod.stock + m.cantidad
      await supabase.from('productos').update({ stock: newStock }).eq('id', prod.id)
    }
    await supabase.from('movimientos').delete().eq('id', m.id)
    load()
  }

  const formatFecha = f => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-ES') : '—'

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Cargando...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Movimientos</div>
          <div className="page-sub">Entradas y salidas de inventario</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ Registrar</button>
      </div>

      <div className="filter-bar">
        <input
          style={{ width: 200 }}
          placeholder="Buscar..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={{ width: 150 }} value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}>
          <option value="">Todos</option>
          <option value="entrada">Entradas</option>
          <option value="salida">Salidas</option>
        </select>
        <span style={{ color: '#888', fontSize: 12 }}>{filtered.length} registros</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Producto</th>
              <th>Tipo</th>
              <th>Cantidad</th>
              <th>Referencia</th>
              <th>Notas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.id}>
                <td style={{ color: '#888', fontSize: 13 }}>{formatFecha(m.fecha)}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{m.productos?.nombre}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{m.productos?.cat}</div>
                </td>
                <td>
                  <span className={`badge badge-${m.tipo === 'entrada' ? 'ok' : 'warn'}`}>{m.tipo}</span>
                </td>
                <td style={{ fontWeight: 600, color: m.tipo === 'entrada' ? '#2e7d32' : '#f57f17' }}>
                  {m.tipo === 'entrada' ? '+' : '−'}{m.cantidad}
                </td>
                <td style={{ fontSize: 13 }}>{m.ref || '—'}</td>
                <td style={{ fontSize: 13, color: '#888' }}>{m.notas || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-sm" onClick={() => openEdit(m)}>✏️</button>
                    <button className="btn btn-sm btn-danger" onClick={() => del(m)}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state">Sin movimientos</div>}
      </div>

      {modal && (
        <Modal
          title={modal === 'new' ? 'Registrar movimiento' : 'Editar movimiento'}
          onClose={() => setModal(null)}
        >
          <div className="form-row c2">
            <div>
              <label>Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
              </select>
            </div>
            <div>
              <label>Producto</label>
              <select value={form.prod_id} onChange={e => setForm({ ...form, prod_id: e.target.value })}>
                {productos.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.stock} {p.unidad})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row c3">
            <div>
              <label>Cantidad</label>
              <input
                type="number"
                min="1"
                value={form.cantidad}
                onChange={e => setForm({ ...form, cantidad: e.target.value })}
              />
            </div>
            <div>
              <label>Referencia</label>
              <input
                value={form.ref}
                placeholder="Cliente / pedido"
                onChange={e => setForm({ ...form, ref: e.target.value })}
              />
            </div>
            <div>
              <label>Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
          </div>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Guardando...' : modal === 'new' ? '✓ Registrar' : '✓ Guardar cambios'}
          </button>
        </Modal>
      )}
    </div>
  )
}
