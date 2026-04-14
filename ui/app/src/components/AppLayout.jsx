import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav.jsx'
import InstallPwaPrompt from './InstallPwaPrompt.jsx'

export default function AppLayout() {
  return (
    <div className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-[color:var(--bg)] md:flex-row">
      <BottomNav />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
      <InstallPwaPrompt />
    </div>
  )
}
