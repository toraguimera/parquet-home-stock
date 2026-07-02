import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

// Familias que se consideran PUERTAS. El resto de categorías son complementos.
const DOOR_CATS = ['2 Rayas Verticales', '4 Rayas', 'Lisa', 'Pulsera']
const esPuerta = (p) => DOOR_CATS.includes(p.cat)

const EMPTY = { nombre: '', cat: '2 Rayas Verticales', stock: 0, min: 10, max: 20, coste: 0, unidad: 'ud', ubicacion: '' }

export default function Stock() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [familia, setFamilia] = useState('Puertas')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('productos').select('*').order('cat').order('nombre')
    setProductos(data || [])
    setLoading(false)
  }

  function getStatus(p) {
    if (p.stock === 0) return { label: 'Sin stock', cls: 'crit' }
    if (p.stock <= p.min) return { label: 'Bajo mínimo', cls: 'warn' }
    return { label: 'OK', cls: 'ok' }
  }

  function barColor(pct) {
    if (pct >= 60) return '#2e7d32'
    if (pct >= 30) return '#f57f17'
    return '#c62828'
  }

  // Todas las categorías (para el desplegable del formulario)
  const allCats = [...new Set(productos.map(p => p.cat))]

  // Productos de la pestaña activa
  const base = productos.filter(p => familia === 'Puertas' ? esPuerta(p) : !esPuerta(p))
  const cats = [...new Set(base.map(p => p.cat))]

  const nPuertas = productos.filter(esPuerta).length
  const nComplementos = productos.length - nPuertas

  const filtered = base.filter(p => {
    if (search && !p.nombre.toLowerCase().includes(search.toLowerCase())) return false
    if (catFilter && p.cat !== catFilter) return false
    const st = getStatus(p)
    if (estadoFilter === 'ok' && st.cls !== 'ok') return false
    if (estadoFilter === 'bajo' && st.cls !== 'warn') return false
    if (estadoFilter === 'sin' && st.cls !== 'crit') return false
    return true
  })

  const totalUnidades = filtered.reduce((s, p) => s + (p.stock || 0), 0)

  function switchFamilia(f) {
    setFamilia(f)
    setCatFilter('')
    setSearch('')
    setEstadoFilter('')
  }

  function openNew() {
    const defCat = familia === 'Puertas' ? '2 Rayas Verticales' : (cats[0] || 'Batientes (Marco fijo)')
    setForm({ ...EMPTY, cat: defCat })
    setModal('new')
  }
  function openEdit(p) { setForm({ ...p }); setModal('edit') }

  async function save() {
    setSaving(true)
    if (modal === 'new') {
      const { data } = await supabase.from('productos').insert([form]).select()
      const creado = data && data[0]
      if (creado && +form.stock > 0) {
        await supabase.from('movimientos').insert([{ prod_id: creado.id, tipo: 'entrada', cantidad: +form.stock, ref: 'Alta producto', notas: 'Stock inicial', fecha: new Date().toISOString().slice(0,10) }])
      }
    } else {
      const { id, created_at, ...rest } = form
      const prev = productos.find(p => p.id === id)
      await supabase.from('productos').update(rest).eq('id', id)
      if (prev && +rest.stock !== +prev.stock) {
        const delta = +rest.stock - +prev.stock
        await supabase.from('movimientos').insert([{ prod_id: id, tipo: delta > 0 ? 'entrada' : 'salida', cantidad: Math.abs(delta), ref: 'Ajuste manual', notas: 'Edicion en Existencias', fecha: new Date().toISOString().slice(0,10) }])
      }
    }
    setSaving(false)
    setModal(null)
    load()
  }

  async function del(id) {
    if (!confirm('¿Eliminar producto?')) return
    await supabase.from('productos').delete().eq('id', id)
    load()
  }

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Cargando...</div>

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Stock</div><div className="page-sub">Inventario completo</div></div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nuevo producto</button>
      </div>

      <div className="tabs" style={{display:'flex',gap:8,marginBottom:16,borderBottom:'1px solid #e5e5e5'}}>
        <button
          onClick={()=>switchFamilia('Puertas')}
          style={{padding:'8px 16px',border:'none',background:'none',cursor:'pointer',fontSize:14,fontWeight:familia==='Puertas'?600:400,color:familia==='Puertas'?'#1a1a1a':'#888',borderBottom:familia==='Puertas'?'2px solid #1a1a1a':'2px solid transparent'}}>
          🚪 Puertas <span style={{fontSize:12,color:'#888'}}>({nPuertas})</span>
        </button>
        <button
          onClick={()=>switchFamilia('Complementos')}
          style={{padding:'8px 16px',border:'none',background:'none',cursor:'pointer',fontSize:14,fontWeight:familia==='Complementos'?600:400,color:familia==='Complementos'?'#1a1a1a':'#888',borderBottom:familia==='Complementos'?'2px solid #1a1a1a':'2px solid transparent'}}>
          🧩 Complementos <span style={{fontSize:12,color:'#888'}}>({nComplementos})</span>
        </button>
      </div>

      <div className="filter-bar">
        <input style={{width:200}} placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} />
        <select style={{width:220}} value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
          <option value="">Todas las categorías</option>
          {cats.map(c=><option key={c}>{c}</option>)}
        </select>
        <select style={{width:150}} value={estadoFilter} onChange={e=>setEstadoFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="ok">OK</option>
          <option value="bajo">Bajo mínimo</option>
          <option value="sin">Sin stock</option>
        </select>
        <span style={{color:'#888',fontSize:12}}>{filtered.length} productos · {totalUnidades} uds</span>
      </div>

      <div className="card" style={{padding:0}}>
        <table className="tbl">
          <thead><tr><th>Producto</th><th>Categoría</th><th>Stock</th><th>Mín/Máx</th><th>Nivel</th><th>Estado</th><th>Coste</th><th></th></tr></thead>
          <tbody>
            {filtered.map(p => {
              const st = getStatus(p)
              const pct = p.max > 0 ? Math.min(100, Math.round((p.stock/p.max)*100)) : 0
              return (
                <tr key={p.id}>
                  <td style={{fontWeight:500}}>{p.nombre}{p.ubicacion && <div style={{fontSize:11,color:'#888',fontWeight:400,marginTop:2}}>📍 {p.ubicacion}</div>}</td>
                  <td><span className="badge badge-gray">{p.cat}</span></td>
                  <td style={{fontWeight:600}}>{p.stock} <span style={{fontSize:11,color:'#888',fontWeight:400}}>{p.unidad}</span></td>
                  <td style={{color:'#888',fontSize:12}}>{p.min} / {p.max}</td>
                  <td><div className="bar-wrap"><div className="bar" style={{width:pct+'%',background:barColor(pct)}} /></div><span style={{fontSize:11}}>{pct}%</span></td>
                  <td><span className={`badge badge-${st.cls}`}>{st.label}</span></td>
                  <td style={{fontSize:13}}>{p.coste?p.coste+'€':'—'}</td>
                  <td><div style={{display:'flex',gap:4}}><button className="btn btn-sm" onClick={()=>openEdit(p)}>✏️</button><button className="btn btn-sm btn-danger" onClick={()=>del(p.id)}>🗑</button></div></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state">Sin productos</div>}
      </div>

      {modal && (
        <Modal title={modal==='new'?'Nuevo producto':'Editar producto'} onClose={()=>setModal(null)}>
          <div className="form-row c2">
            <div><label>Nombre</label><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} /></div>
            <div><label>Categoría</label><input list="catlist" value={form.cat} onChange={e=>setForm({...form,cat:e.target.value})} /><datalist id="catlist">{allCats.map(c=><option key={c} value={c} />)}</datalist></div>
          </div>
          <div className="form-row c4">
            <div><label>Stock</label><input type="number" value={form.stock} onChange={e=>setForm({...form,stock:+e.target.value})} /></div>
            <div><label>Mínimo</label><input type="number" value={form.min} onChange={e=>setForm({...form,min:+e.target.value})} /></div>
            <div><label>Máximo</label><input type="number" value={form.max} onChange={e=>setForm({...form,max:+e.target.value})} /></div>
            <div><label>Coste €</label><input type="number" value={form.coste} onChange={e=>setForm({...form,coste:+e.target.value})} /></div>
          </div>
          <div className="form-row c2"><div><label>Unidad</label><input value={form.unidad} onChange={e=>setForm({...form,unidad:e.target.value})} /></div><div><label>Ubicación</label><input value={form.ubicacion||''} onChange={e=>setForm({...form,ubicacion:e.target.value})} placeholder="Ej: Estantería 13 · Piso 2 o Suelo" /></div></div>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Guardando...':'✓ Guardar'}</button>
        </Modal>
      )}
    </div>
  )
}
