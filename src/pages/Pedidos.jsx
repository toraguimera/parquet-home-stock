import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const EMPTY = {
  num: '',
  proveedor: '',
  fecha_pedido: new Date().toISOString().slice(0, 10),
  fecha_entrega: '',
  estado: 'pendiente',
  total: 0,
  notas: ''
}

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [lineas, setLineas] = useState([])
  const [lineaForm, setLineaForm] = useState({ prod_id: '', cantidad: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: peds }, { data: prods }] = await Promise.all([
      supabase.from('pedidos').select('*').order('created_at', { ascending: false }),
      supabase.from('productos').select('id, nombre, stock, unidad').order('nombre')
    ])
    setPedidos(peds || [])
    setProductos(prods || [])
    setLoading(false)
  }

  const filtered = pedidos.filter(p => filtro === 'todos' || p.estado === filtro)
  const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-ES') : '—'

  function openModal() {
    setForm(EMPTY)
    setLineas([])
    setLineaForm({ prod_id: '', cantidad: '' })
    setModal(true)
  }

  function closeModal() {
    setModal(false)
    setLineas([])
    setLineaForm({ prod_id: '', cantidad: '' })
  }

  function addLinea() {
    if (!lineaForm.prod_id || !lineaForm.cantidad || +lineaForm.cantidad <= 0) return
    const prod = productos.find(p => p.id === +lineaForm.prod_id)
    if (!prod) return
    const existing = lineas.findIndex(l => l.prod_id === +lineaForm.prod_id)
    if (existing >= 0) {
      const updated = [...lineas]
      updated[existing] = { ...updated[existing], cantidad: updated[existing].cantidad + +lineaForm.cantidad }
      setLineas(updated)
    } else {
      setLineas([...lineas, {
        prod_id: +lineaForm.prod_id,
        nombre: prod.nombre,
        unidad: prod.unidad || 'ud',
        cantidad: +lineaForm.cantidad
      }])
    }
    setLineaForm({ prod_id: '', cantidad: '' })
  }

  function removeLinea(i) {
    setLineas(lineas.filter((_, idx) => idx !== i))
  }

  async function save() {
    if (!form.proveedor.trim()) { alert('Indica el cliente o empresa'); return }
    if (lineas.length === 0) { alert('Añade al menos un producto al pedido'); return }
    setSaving(true)

    const { data: freshProds } = await supabase
      .from('productos')
      .select('id, nombre, stock, unidad')
      .order('nombre')

    for (const linea of lineas) {
      const prod = freshProds.find(p => p.id === linea.prod_id)
      if (!prod) continue
      if (linea.cantidad > prod.stock) {
        alert(`Stock insuficiente para "${linea.nombre}": solo hay ${prod.stock} ${prod.unidad || 'ud'}`)
        setSaving(false)
        return
      }
    }

    const num = form.num || `PED-${String(pedidos.length + 1).padStart(3, '0')}`
    const fecha = form.fecha_pedido || new Date().toISOString().slice(0, 10)

    const { error } = await supabase.from('pedidos').insert([{
      ...form,
      num,
      productos: JSON.stringify(lineas)
    }])

    if (error) {
      alert('Error al guardar el pedido')
      setSaving(false)
      return
    }

    const stockLocal = {}
    freshProds.forEach(p => { stockLocal[p.id] = p.stock })

    for (const linea of lineas) {
      const nuevoStock = stockLocal[linea.prod_id] - linea.cantidad
      stockLocal[linea.prod_id] = nuevoStock

      await supabase.from('productos')
        .update({ stock: nuevoStock })
        .eq('id', linea.prod_id)

      await supabase.from('movimientos').insert([{
        prod_id: linea.prod_id,
        tipo: 'salida',
        cantidad: linea.cantidad,
        ref: num,
        fecha,
        notas: form.proveedor ? `Pedido ${num} · ${form.proveedor}` : `Pedido ${num}`
      }])
    }

    if (form.fecha_entrega) {
      await supabase.from('eventos').insert([{
        fecha: form.fecha_entrega,
        titulo: `Entrega ${num}`,
        tipo: 'entrega',
        notas: form.proveedor
      }])
    }

    setSaving(false)
    closeModal()
    load()
  }

  async function avanzar(p) {
    const next = p.estado === 'pendiente' ? 'en_camino' : 'recibido'
    await supabase.from('pedidos').update({ estado: next }).eq('id', p.id)
    load()
  }

  async function del(p) {
    if (!confirm(`¿Eliminar pedido ${p.num}?\nSe revertirán los movimientos de stock generados.`)) return

    const lineasPedido = parseLineas(p.productos)
    if (lineasPedido.length > 0) {
      const { data: freshProds } = await supabase
        .from('productos')
        .select('id, stock')
      const stockMap = {}
      freshProds.forEach(pr => { stockMap[pr.id] = pr.stock })

      for (const linea of lineasPedido) {
        const nuevoStock = (stockMap[linea.prod_id] || 0) + linea.cantidad
        await supabase.from('productos').update({ stock: nuevoStock }).eq('id', linea.prod_id)
      }
    }

    await supabase.from('pedidos').delete().eq('id', p.id)
    load()
  }

  function parseLineas(productosStr) {
    if (!productosStr) return []
    try { return JSON.parse(productosStr) } catch { return [] }
  }

  const estadoLabel = { pendiente: 'Pendiente', en_camino: 'En camino', recibido: 'Recibido' }
  const estadoCls = { pendiente: 'gray', en_camino: 'info', recibido: 'ok' }

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Cargando...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Pedidos</div>
          <div className="page-sub">Gestión de pedidos · el stock se actualiza automáticamente</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openModal}>+ Nuevo pedido</button>
      </div>

      <div className="tab-bar">
        {['todos', 'pendiente', 'en_camino', 'recibido'].map(f => (
          <button key={f} className={`tab-btn ${filtro === f ? 'active' : ''}`} onClick={() => setFiltro(f)}>
            {f === 'todos' ? 'Todos' : estadoLabel[f]}
            {f !== 'todos' && (
              <span style={{ marginLeft: 4, fontSize: 11, color: '#888' }}>
                ({pedidos.filter(p => p.estado === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Nº pedido</th>
              <th>Cliente / Empresa</th>
              <th>Productos</th>
              <th>Fecha</th>
              <th>Entrega</th>
              <th>Estado</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const lineasParsed = parseLineas(p.productos)
              return (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.num}</td>
                  <td>{p.proveedor}</td>
                  <td style={{ fontSize: 12, maxWidth: 220 }}>
                    {lineasParsed.length > 0
                      ? lineasParsed.map((l, i) => (
                          <div key={i} style={{ whiteSpace: 'nowrap', lineHeight: '1.6' }}>
                            <strong>{l.cantidad}</strong> × {l.nombre}
                          </div>
                        ))
                      : <span style={{ color: '#9ca3af' }}>{p.productos}</span>
                    }
                  </td>
                  <td style={{ fontSize: 12, color: '#888' }}>{fmtDate(p.fecha_pedido)}</td>
                  <td style={{ fontSize: 12 }}>{fmtDate(p.fecha_entrega)}</td>
                  <td>
                    <span className={`badge badge-${estadoCls[p.estado]}`}>
                      {estadoLabel[p.estado]}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{p.total ? p.total + '€' : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {p.estado !== 'recibido' && (
                        <button className="btn btn-sm" onClick={() => avanzar(p)}>→</button>
                      )}
                      <button className="btn btn-sm btn-danger" onClick={() => del(p)}>🗑</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state">✅ Sin pedidos</div>}
      </div>

      {modal && (
        <Modal title="Nuevo pedido" onClose={closeModal}>
          <div className="form-row c2">
            <div>
              <label>Nº pedido</label>
              <input
                value={form.num}
                placeholder={`Auto (PED-${String(pedidos.length + 1).padStart(3, '0')})`}
                onChange={e => setForm({ ...form, num: e.target.value })}
              />
            </div>
            <div>
              <label>Cliente / Empresa</label>
              <input
                value={form.proveedor}
                placeholder="Ej: Parquet Home BCN"
                onChange={e => setForm({ ...form, proveedor: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row c2">
            <div>
              <label>Fecha pedido</label>
              <input
                type="date"
                value={form.fecha_pedido}
                onChange={e => setForm({ ...form, fecha_pedido: e.target.value })}
              />
            </div>
            <div>
              <label>Entrega estimada</label>
              <input
                type="date"
                value={form.fecha_entrega}
                onChange={e => setForm({ ...form, fecha_entrega: e.target.value })}
              />
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <label style={{ fontWeight: 600, fontSize: 14 }}>Productos del pedido</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 3 }}>
                <select
                  value={lineaForm.prod_id}
                  onChange={e => setLineaForm({ ...lineaForm, prod_id: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="">Seleccionar producto...</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — stock: {p.stock} {p.unidad || 'ud'}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="number"
                  min="1"
                  placeholder="Cantidad"
                  value={lineaForm.cantidad}
                  onChange={e => setLineaForm({ ...lineaForm, cantidad: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && addLinea()}
                  style={{ width: '100%' }}
                />
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={addLinea}
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >+ Añadir</button>
            </div>

            {lineas.length > 0 ? (
              <div style={{ marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600 }}>Producto</th>
                      <th style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>Cantidad</th>
                      <th style={{ padding: '6px 4px', width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l, i) => (
                      <tr key={i} style={{ borderBottom: i < lineas.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <td style={{ padding: '8px 12px' }}>{l.nombre}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{l.cantidad} {l.unidad}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                          <button onClick={() => removeLinea(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 8, textAlign: 'center', padding: '16px 0', border: '1px dashed #e5e7eb', borderRadius: 8 }}>
                Sin productos añadidos
              </div>
            )}
          </div>

          <div className="form-row c2" style={{ marginTop: 16 }}>
            <div>
              <label>Total €</label>
              <input type="number" value={form.total} onChange={e => setForm({ ...form, total: +e.target.value })} />
            </div>
            <div>
              <label>Notas</label>
              <input value={form.notas} placeholder="Observaciones..." onChange={e => setForm({ ...form, notas: e.target.value })} />
            </div>
          </div>

          {lineas.length > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#fffbeb', borderRadius: 6, fontSize: 12, color: '#92400e', border: '1px solid #fde68a' }}>
              ⚡ Al crear el pedido, el stock se descontará automáticamente para{' '}
              {lineas.length === 1 ? '1 producto' : `${lineas.length} productos`}{' '}y quedará registrado en Movimientos.
            </div>
          )}

          <button className="btn btn-primary" onClick={save} disabled={saving} style={{ marginTop: 16, width: '100%' }}>
            {saving ? 'Guardando...' : '✓ Crear pedido y actualizar stock'}
          </button>
        </Modal>
      )}
    </div>
  )
}
