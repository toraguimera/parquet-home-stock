import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const EMPTY = { nombre: '', cat: '', contacto: '', tel: '', email: '', notas: '' }

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('proveedores').select('*').order('nombre')
    setProveedores(data || [])
    setLoading(false)
  }

  function openNew() { setForm(EMPTY); setModal('new') }
  function openEdit(p) { setForm({ ...p }); setModal('edit') }

  async function save() {
    setSaving(true)
    if (modal === 'new') {
      await supabase.from('proveedores').insert([form])
    } else {
      const { id, created_at, ...rest } = form
      await supabase.from('proveedores').update(rest).eq('id', id)
    }
    setSaving(false)
    setModal(null)
    load()
  }

  async function del(id) {
    if (!confirm('¿Eliminar proveedor?')) return
    await supabase.from('proveedores').delete().eq('id', id)
    load()
  }

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Cargando...</div>

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Proveedores</div><div className="page-sub">Directorio de proveedores</div></div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ Añadir proveedor</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
        {proveedores.map(p => (
          <div key={p.id} className="card">
            <div style={{fontWeight:600,fontSize:15,marginBottom:6}}>{p.nombre}</div>
            {p.cat&&<div style={{fontSize:12,color:'#888',marginBottom:8}}>📂 {p.cat}</div>}
            {p.contacto&&<div style={{fontSize:13,marginBottom:3}}>👤 {p.contacto}</div>}
            {p.tel&&<div style={{fontSize:13,marginBottom:3}}>📞 {p.tel}</div>}
            {p.email&&<div style={{fontSize:13,marginBottom:3}}>✉️ {p.email}</div>}
            {p.notas&&<div style={{fontSize:12,color:'#888',marginTop:8,paddingTop:8,borderTop:'1px solid #e8e6e0'}}>{p.notas}</div>}
            <div style={{display:'flex',gap:6,marginTop:12}}>
              <button className="btn btn-sm" onClick={()=>openEdit(p)}>✏️ Editar</button>
              <button className="btn btn-sm btn-danger" onClick={()=>del(p.id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
      {proveedores.length === 0 && <div className="empty-state">Sin proveedores</div>}
      {modal && (
        <Modal title={modal==='new'?'Nuevo proveedor':'Editar proveedor'} onClose={()=>setModal(null)}>
          <div className="form-row c2">
            <div><label>Nombre</label><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} /></div>
            <div><label>Categoría</label><input value={form.cat} placeholder="Puertas, Accesorios..." onChange={e=>setForm({...form,cat:e.target.value})} /></div>
          </div>
          <div className="form-row c2">
            <div><label>Contacto</label><input value={form.contacto} onChange={e=>setForm({...form,contacto:e.target.value})} /></div>
            <div><label>Teléfono</label><input value={form.tel} onChange={e=>setForm({...form,tel:e.target.value})} /></div>
          </div>
          <div className="form-row"><div><label>Email</label><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div></div>
          <div className="form-row"><div><label>Notas</label><textarea value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} /></div></div>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Guardando...':'✓ Guardar'}</button>
        </Modal>
      )}
    </div>
  )
}