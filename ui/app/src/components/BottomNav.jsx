import { NavLink } from 'react-router-dom'

const baseLinkClasses =
  'flex flex-col items-center gap-1 rounded-button px-4 py-2 text-[0.75rem] font-medium text-[color:var(--text-muted)] no-underline transition-colors md:flex-row md:justify-start md:gap-3 md:px-3 md:py-2.5 md:text-sm'

export default function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex min-h-[var(--bottom-nav-height)] flex-shrink-0 items-center justify-around border-t border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-2px_8px_rgba(0,0,0,0.1)] md:static md:z-auto md:h-dvh md:min-h-0 md:w-56 md:flex-col md:items-stretch md:justify-start md:gap-1 md:border-r md:border-t-0 md:px-3 md:pb-4 md:pt-3 md:shadow-none"
      role="navigation"
      aria-label="Main"
    >
      <div className="hidden w-full items-center justify-start gap-2 pb-3 pl-3 pr-2 md:flex">
        <img src="/logo.webp" alt="az7" className="h-20 w-auto flex-shrink-0" />
      </div>
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `${baseLinkClasses} hover:text-[color:var(--text-primary)] ${
            isActive
              ? 'text-[color:var(--accent)] md:bg-[color:var(--tab-active-bg)]'
              : 'md:hover:bg-[color:var(--tab-active-bg)]/70'
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
        to="/shorts"
        className={({ isActive }) =>
          `${baseLinkClasses} hover:text-[color:var(--text-primary)] ${
            isActive
              ? 'text-[color:var(--accent)] md:bg-[color:var(--tab-active-bg)]'
              : 'md:hover:bg-[color:var(--tab-active-bg)]/70'
          }`
        }
      >
        <span
          className="material-symbols-outlined text-xl"
          style={{ fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24' }}
          aria-hidden
        >
          movie
        </span>
        <span>Shorts</span>
      </NavLink>
      <NavLink
        to="/create-post"
        className={({ isActive }) =>
          `${baseLinkClasses} hover:text-[color:var(--text-primary)] ${
            isActive
              ? 'text-[color:var(--accent)] md:bg-[color:var(--tab-active-bg)]'
              : 'md:hover:bg-[color:var(--tab-active-bg)]/70'
          }`
        }
      >
        <span
          className="material-symbols-outlined text-xl"
          style={{ fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24' }}
          aria-hidden
        >
          post_add
        </span>
        <span>Create</span>
      </NavLink>
      <NavLink
        to="/messages"
        className={({ isActive }) =>
          `${baseLinkClasses} hover:text-[color:var(--text-primary)] ${
            isActive
              ? 'text-[color:var(--accent)] md:bg-[color:var(--tab-active-bg)]'
              : 'md:hover:bg-[color:var(--tab-active-bg)]/70'
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
            isActive
              ? 'text-[color:var(--accent)] md:bg-[color:var(--tab-active-bg)]'
              : 'md:hover:bg-[color:var(--tab-active-bg)]/70'
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
            isActive
              ? 'text-[color:var(--accent)] md:bg-[color:var(--tab-active-bg)]'
              : 'md:hover:bg-[color:var(--tab-active-bg)]/70'
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
