export default function HeroKoi({ paused }: { paused: boolean }) {
  return <span className={`hero-koi${paused ? " is-paused" : ""}`} aria-hidden="true">
    <svg viewBox="0 0 84 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hero-koi-body" x1="25" y1="8" x2="70" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fffdf8" />
          <stop offset="1" stopColor="#e7e5e0" />
        </linearGradient>
        <clipPath id="hero-koi-clip"><path d="M20 22C30 10 47 7 61 12C70 15 76 20 76 22C76 25 69 31 60 34C46 39 30 34 20 22Z" /></clipPath>
      </defs>
      <g className="hero-koi-tail">
        <path d="M22 21C14 10 7 9 3 11C7 17 8 21 8 22C8 24 6 29 3 34C10 36 17 32 23 24Z" fill="#ed7b4b" stroke="#bf5939" strokeWidth="1.3" />
        <path d="M10 14C14 19 14 26 9 31" stroke="#f7b08b" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <path d="M34 12C37 4 44 3 48 8L46 13M36 33C40 40 46 41 49 35" fill="#e9a078" stroke="#c36c47" strokeWidth="1.2" />
      <path d="M20 22C30 10 47 7 61 12C70 15 76 20 76 22C76 25 69 31 60 34C46 39 30 34 20 22Z" fill="url(#hero-koi-body)" stroke="#c9c4bc" strokeWidth="1.4" />
      <g clipPath="url(#hero-koi-clip)">
        <path d="M24 10C32 9 35 14 34 22C33 29 27 31 20 31L18 17Z" fill="#f18a54" />
        <path d="M41 8C49 7 55 12 53 19C52 24 47 26 42 24C37 21 36 13 41 8Z" fill="#ee7848" />
        <path d="M54 28C57 23 65 24 71 26L77 34L58 39Z" fill="#e7814f" />
        <path d="M27 16C42 8 61 13 70 19" stroke="#fff" strokeOpacity=".65" strokeWidth="2" strokeLinecap="round" />
      </g>
      <circle cx="67" cy="19" r="2.1" fill="#2b2928" />
      <circle cx="67.5" cy="18.5" r=".65" fill="#fff" />
      <path d="M74 23L81 26M74 24L80 31" stroke="#a9978b" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  </span>;
}
