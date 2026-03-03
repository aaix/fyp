import { NavLink } from 'react-router-dom'

const baseLinkClasses =
  'flex flex-col items-center gap-1 rounded-button px-4 py-2 text-[0.75rem] font-medium text-[color:var(--text-muted)] no-underline transition-colors'

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 mx-2 mb-2 flex flex-shrink-0 items-center justify-around rounded-t-cardSm border-t border-[color:var(--card-border)] bg-[color:var(--card-bg)] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-2px_8px_rgba(0,0,0,0.1)]"
      role="navigation"
      aria-label="Main"
    >
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `${baseLinkClasses} hover:text-[color:var(--text-primary)] ${
            isActive ? 'text-[color:var(--accent)]' : ''
          }`
        }
      >
        <span
          className="material-symbols-outlined text-xl"
          style={{ fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24' }}
          aria-hidden
        >
          home
        </span>
        <span>Home</span>
      </NavLink>
      <NavLink
        to="/messages"
        className={({ isActive }) =>
          `${baseLinkClasses} hover:text-[color:var(--text-primary)] ${
            isActive ? 'text-[color:var(--accent)]' : ''
          }`
        }
      >
        <span
          className="material-symbols-outlined text-xl"
          style={{ fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24' }}
          aria-hidden
        >
          mail
        </span>
        <span>Messages</span>
      </NavLink>
      <NavLink
        to="/search"
        className={({ isActive }) =>
          `${baseLinkClasses} hover:text-[color:var(--text-primary)] ${
            isActive ? 'text-[color:var(--accent)]' : ''
          }`
        }
      >
        <span
          className="material-symbols-outlined text-xl"
          style={{ fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24' }}
          aria-hidden
        >
          search
        </span>
        <span>Search</span>
      </NavLink>
      <NavLink
        to="/account"
        className={({ isActive }) =>
          `${baseLinkClasses} hover:text-[color:var(--text-primary)] ${
            isActive ? 'text-[color:var(--accent)]' : ''
          }`
        }
      >
        <span
          className="material-symbols-outlined text-xl"
          style={{ fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24' }}
          aria-hidden
        >
          person
        </span>
        <span>Account</span>
      </NavLink>
    </nav>
  )
}
