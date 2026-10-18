import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.js'
import { Brand, LogoMark } from './Logo.jsx'

const stripHtml = (html = '') =>
  html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

export default function App() {
  const [courses, setCourses] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState('')

  const authDialog = useRef(null)
  const courseDialog = useRef(null)
  const toastTimer = useRef(null)

  const notify = (message) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 5000)
  }

  // Restore session after refresh.
  useEffect(() => {
    api.me().then((d) => setUser(d.user)).catch(() => {})
  }, [])

  // Course catalogue from Moodle (via backend).
  useEffect(() => {
    api
      .courses()
      .then((data) => {
        setCourses(
          data.map((c, i) => ({
            id: c.id,
            number: String(i + 1).padStart(2, '0'),
            title: c.name || c.shortname || 'Untitled course',
            shortname: c.shortname,
            description: stripHtml(c.summary) || 'Open the course to learn more about what it covers.',
          })),
        )
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? courses.filter((c) => `${c.title} ${c.shortname} ${c.description}`.toLowerCase().includes(q)) : courses
  }, [courses, query])

  const openAuth = (mode) => {
    setAuthMode(mode)
    setMenuOpen(false)
    authDialog.current?.showModal()
  }
  const openCourse = (course) => {
    setSelected(course)
    courseDialog.current?.showModal()
  }
  const logout = async () => {
    try {
      await api.logout()
      setUser(null)
      notify('You have been logged out.')
    } catch (e) {
      notify(e.message)
    }
  }

  return (
    <div className="app">
      <header className="site-header">
        <Brand />
        <button className="menu-toggle" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          <span /><span /><span />
        </button>
        <nav className={`nav ${menuOpen ? 'open' : ''}`}>
          <a href="#courses" onClick={() => setMenuOpen(false)}>Courses</a>
          <a href="#how" onClick={() => setMenuOpen(false)}>How it works</a>
          {user ? (
            <>
              <span className="nav-user">{user.fullname || user.username}</span>
              <button className="btn btn-ghost" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => openAuth('login')}>Log in</button>
              <button className="btn btn-primary" onClick={() => openAuth('signup')}>Get started</button>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-copy">
            <p className="eyebrow">We Code Health Academy</p>
            <h1>
              Build skills.<br />
              <span className="grad">Unlock your potential.</span>
            </h1>
            <p className="lead">
              Practical, focused online courses designed to help you move forward with confidence — learn at your pace, from wherever you are.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary btn-lg" href="#courses">Explore courses</a>
              {!user && <button className="btn btn-ghost btn-lg" onClick={() => openAuth('signup')}>Create account</button>}
            </div>
          </div>
        </section>

        <section className="features" aria-label="Platform benefits">
          <div className="feature"><b>Learn at your pace</b><span>Study when it suits you, on any device.</span></div>
          <div className="feature"><b>Practical by design</b><span>Hands-on courses focused on real skills.</span></div>
          <div className="feature"><b>One secure account</b><span>Your courses and progress, in one place.</span></div>
        </section>

        <section className="section" id="courses">
          <div className="section-head">
            <div>
              <p className="eyebrow">Course catalogue</p>
              <h2>Find your next <span className="grad">course</span></h2>
            </div>
            <label className="search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input type="search" placeholder="Search courses…" aria-label="Search courses" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>

          <div className="grid">
            {status === 'loading' && <p className="state">Loading courses…</p>}
            {status === 'error' && <p className="state">Couldn’t load courses. Check that Moodle and the backend are running.</p>}
            {status === 'ready' && visible.length === 0 && <p className="state">{courses.length ? 'No courses match your search.' : 'No courses published yet.'}</p>}
            {status === 'ready' &&
              visible.map((c) => (
                <article className="card" key={c.id}>
                  <div className="card-art" aria-hidden="true"><span>{c.number}</span></div>
                  <div className="card-body">
                    <h3>{c.title}</h3>
                    <p>{c.description}</p>
                    <button className="link" onClick={() => openCourse(c)}>View course →</button>
                  </div>
                </article>
              ))}
          </div>
        </section>

        <section className="section how" id="how">
          <p className="eyebrow">Simple by design</p>
          <h2>Three steps to <span className="grad">start learning</span></h2>
          <ol className="steps">
            <li><span>01</span><h3>Find your course</h3><p>Browse the catalogue and pick the path that fits your goals.</p></li>
            <li><span>02</span><h3>Create your account</h3><p>Sign up once and sign in securely on any device.</p></li>
            <li><span>03</span><h3>Learn and progress</h3><p>Continue where you left off and track your progress.</p></li>
          </ol>
        </section>

        {!user && (
          <section className="cta">
            <div>
              <h2>Ready when <span className="grad">you are.</span></h2>
              <p>Create your learner account and get ready for your first course.</p>
            </div>
            <button className="btn btn-primary btn-lg" onClick={() => openAuth('signup')}>Get started</button>
          </section>
        )}
      </main>

      <footer className="site-footer">
        <Brand />
        <span>© {new Date().getFullYear()} We Code Health. All rights reserved.</span>
      </footer>

      <AuthDialog
        dialogRef={authDialog}
        mode={authMode}
        setMode={setAuthMode}
        onLoggedIn={(u) => { setUser(u); notify(`Welcome back, ${u.fullname || u.username}!`) }}
        onRegistered={() => { setAuthMode('login'); notify('Account created. You can now log in.') }}
      />

      <dialog className="modal" ref={courseDialog} onClick={(e) => e.target === courseDialog.current && courseDialog.current.close()}>
        <div className="modal-card">
          <button className="modal-close" aria-label="Close" onClick={() => courseDialog.current?.close()}>×</button>
          <LogoMark size={40} />
          <p className="eyebrow">Course preview</p>
          <h2>{selected?.title}</h2>
          <p className="muted">{selected?.description}</p>
          <button
            className="btn btn-primary btn-block"
            onClick={() => { courseDialog.current?.close(); user ? notify('Course access is coming soon.') : openAuth('login') }}
          >
            {user ? 'Continue' : 'Log in to continue'}
          </button>
          <p className="fineprint">Course access will be enabled once enrolment is connected.</p>
        </div>
      </dialog>

      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </div>
  )
}

function AuthDialog({ dialogRef, mode, setMode, onLoggedIn, onRegistered }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const signup = mode === 'signup'

  useEffect(() => setError(''), [mode])

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const f = new FormData(form)
    const email = String(f.get('email')).trim().toLowerCase()
    const password = String(f.get('password'))
    setBusy(true)
    setError('')
    try {
      if (signup) {
        await api.register({ firstname: String(f.get('firstname')).trim(), lastname: String(f.get('lastname')).trim(), email, password })
        form.reset()
        onRegistered()
      } else {
        const { user } = await api.login(email, password)
        form.reset()
        dialogRef.current?.close()
        onLoggedIn(user)
      }
    } catch (e) {
      // `details` only exists in development and explains Moodle-side problems.
      setError(e.details ? `${e.message} (${e.details})` : e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog className="modal" ref={dialogRef} onClick={(e) => e.target === dialogRef.current && !busy && dialogRef.current.close()}>
      <form className="modal-card" onSubmit={submit}>
        <button type="button" className="modal-close" aria-label="Close" disabled={busy} onClick={() => dialogRef.current?.close()}>×</button>
        <LogoMark size={40} />
        <p className="eyebrow">{signup ? 'Start your journey' : 'Welcome back'}</p>
        <h2>{signup ? 'Create your learner account' : 'Log in to We Code Health'}</h2>

        {signup && (
          <div className="row">
            <label>First name<input name="firstname" autoComplete="given-name" required /></label>
            <label>Last name<input name="lastname" autoComplete="family-name" required /></label>
          </div>
        )}
        <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
        <label>
          Password
          <input name="password" type="password" required minLength={signup ? 8 : 1} autoComplete={signup ? 'new-password' : 'current-password'} placeholder={signup ? 'At least 8 characters' : ''} />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Log in'}</button>
        <p className="switch">
          {signup ? 'Already have an account?' : 'New here?'}{' '}
          <button type="button" className="link" disabled={busy} onClick={() => setMode(signup ? 'login' : 'signup')}>
            {signup ? 'Log in' : 'Create an account'}
          </button>
        </p>
      </form>
    </dialog>
  )
}
