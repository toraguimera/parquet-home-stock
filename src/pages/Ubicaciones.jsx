import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Ubicaciones() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('productos').select('id,nombre,cat,stock,min,unidad,ubicacion').order('nombre', { ascending: true })
    setProductos(data || [])
    setLoading(false)
  }

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Cargando...</div>

  const q = search.trim().toLowerCase()
  const filtered = productos.filter(p =>
    !q || (p.nombre || '').toLowerCase().includes(q) || (p.cat || '').toLowerCase().includes(q) || (p.ubicacion || '').toLowerCase().includes(q)
  )

  const groups = {}
  filtered.forEach(p => {
    const key = (p.ubicacion && p.ubicacion.trim()) ? p.ubicacion.trim() : 'Sin ubicación'
    if (!groups[key]) groups[key] = []
    groups[key].push(p)
  })

  const rank = k => k === 'Sin ubicación' ? 2 : (k === 'Suelo' ? 1 : 0)
  const keys = Object.keys(groups).sort((a, b) => rank(a) !== rank(b) ? rank(a) - rank(b) : a.localeCompare(b, 'es', { numeric: true }))
  const totalUds = k => groups[k].reduce((s, p) => s + (+p.stock || 0), 0)

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Ubicaciones</div><div className="page-sub">Dónde está almacenado cada producto</div></div>
      </div>
      <div className="filter-bar">
        <input style={{ width: 260 }} placeholder="Buscar producto, categoría o ubicación..." value={search} onChange={e => setSearch(e.target.value)} />
        <span style={{ color: '#888', fontSize: 12 }}>{keys.length} ubicaciones · {filtered.length} productos</span>
      </div>
      {keys.length === 0 && <div className="empty-state">No hay productos que coincidan.</div>}
      <div className="grid3">
        {keys.map(k => (
          <div key={k} className="card">
            <div className="card-title">
              <span>📍 {k}</span>
              <span className="badge badge-gray">{groups[k].length} ref · {totalUds(k)} ud</span>
            </div>
            <div>
              {groups[k].map(p => {
                const cls = +p.stock <= 0 ? 'badge-crit' : (p.min != null && +p.stock <= +p.min ? 'badge-warn' : 'badge-ok')
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0ede8' }}>
                    <div style={{ minWidth: 0, marginRight: 8 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{p.nombre}</div>
                      <div style={{ marginTop: 3 }}><span className="badge badge-info">{p.cat}</span></div>
                    </div>
                    <span className={"badge " + cls} style={{ flexShrink: 0 }}>{p.stock} {p.unidad || 'ud'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
