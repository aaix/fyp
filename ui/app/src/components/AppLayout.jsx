import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav.jsx'

export default function AppLayout() {
  return (
    <div className="flex h-screen flex-col bg-[color:var(--bg)] overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
