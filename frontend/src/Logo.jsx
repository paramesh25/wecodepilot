// We Code Health mark: a phoenix built from circuit-blue feathers (see brand poster).
export function LogoMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id="wch-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset=".55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#e879f9" />
        </linearGradient>
      </defs>
      <g fill="url(#wch-g)">
        <path d="M32 9c3.5 6 4.5 20 0 46-4.5-26-3.5-40 0-46z" />
        <g id="wch-wing">
          <path d="M29 36C17 36 8 29 5 15c8 8 17 10 24 13z" />
          <path d="M29 42c-10 2-18-2-22-10 8 4 15 4 22 3z" />
          <path d="M29 48c-6 4-12 3-16-1 6 0 11-1 16-4z" />
        </g>
        <use href="#wch-wing" transform="matrix(-1 0 0 1 64 0)" />
      </g>
    </svg>
  )
}

export function Brand({ href = '#home' }) {
  return (
    <a className="brand" href={href} aria-label="We Code Health home">
      <LogoMark />
      <span className="brand-text">
        We Code <b>Health</b>
      </span>
    </a>
  )
}
