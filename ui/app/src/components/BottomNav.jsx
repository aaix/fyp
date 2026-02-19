import { NavLink } from 'react-router-dom'
import './BottomNav.css'

export default function BottomNav() {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main">
      <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
        <span className="nav-icon material-symbols-outlined" aria-hidden>home</span>
        <span>Home</span>
      </NavLink>
      <NavLink to="/messages" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
        <span className="nav-icon material-symbols-outlined" aria-hidden>mail</span>
        <span>Messages</span>
      </NavLink>
      <NavLink to="/account" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
        <span className="nav-icon material-symbols-outlined" aria-hidden>person</span>
        <span>Account</span>
      </NavLink>
    </nav>
  )
}
