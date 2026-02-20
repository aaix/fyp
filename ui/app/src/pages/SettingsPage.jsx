import { Link } from 'react-router-dom'
import './SettingsPage.css'

export default function SettingsPage() {
  return (
    <div className="settings-page">
      <header className="settings-header">
        <Link to="/account" className="settings-back" aria-label="Back to account">
          <span className="material-symbols-outlined" aria-hidden>arrow_back</span>
        </Link>
        <h1 className="settings-title">Settings</h1>
      </header>
      <main className="settings-content">
        <p className="settings-placeholder">Settings options will go here.</p>
      </main>
    </div>
  )
}
