import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Stock from './pages/Stock'
import Movimientos from './pages/Movimientos'
import Pedidos from './pages/Pedidos'
import Clientes from './pages/Clientes'
import Proveedores from './pages/Proveedores'
import Asistente from './pages/Asistente'
import './App.css'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦', section: 'Principal' },
  { id: 'stock', label: 'Stock', icon: '📦', section: 'Principal' },
  { id: 'movimientos', label: 'Movimientos', icon: '⇅', section: 'Principal' },
  { id: 'pedidos', label: 'Pedidos', icon: '🚚', section: 'Gestión' },
  { id: 'clientes', label: 'Clientes', icon: '👥', section: 'Gestión' },
  { id: 'proveedores', label: 'Proveedores', icon: '🏪', section: 'Gestión' },
  { id: 'asistente', label: 'Asistente IA', icon: '🤖', section: 'Herramientas' },
]

export default function App() {
  const [page, setPage] = useState('dashboard')
  const sections = [...new Set(NAV.map(n => n.section))]
  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={setPage} />
      case 'stock': return <Stock />
      case 'movimientos': return <Movimientos />
      case 'pedidos': return <Pedidos />
      case 'clientes': return <Clientes />
      case 'proveedores': return <Proveedores />
      case 'asistente': return <Asistente />
      default: return <Dashboard onNavigate={setPage} />
    }
  }
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-title">🏠 Parquet Home</div>
          <div className="logo-sub">Panel de gestión</div>
        </div>
        {sections.map(section => (
          <div key={section}>
            <div className="nav-section">{section}</div>
            {NAV.filter(n => n.section === section).map(item => (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => setPage(item.id)}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </aside>
      <main className="main">{renderPage()}</main>
    </div>
  )
}