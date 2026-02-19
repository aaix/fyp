import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav.jsx'
import './AppLayout.css'

export default function AppLayout() {
  return (
    <div className="app-layout">
      <div className="app-content">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
