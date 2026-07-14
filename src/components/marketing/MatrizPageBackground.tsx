export function MatrizPageBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 bg-[#fdf8f0]" />
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 74% 46% at 50% 55%, rgba(255,193,7,0.24) 0%, transparent 52%),
            radial-gradient(ellipse 60% 35% at 50% 100%, rgba(180,83,9,0.16) 0%, transparent 45%),
            linear-gradient(180deg, #fdf8f0 0%, #faf3e6 52%, #f3e8d4 100%)
          `,
        }}
      />
      <div className="matriz-bg-smoke absolute bottom-[-12%] left-[4%] h-[42vh] w-[42vw] min-w-80 rounded-full opacity-50" />
      <div className="matriz-bg-smoke absolute bottom-[-15%] right-[2%] h-[48vh] w-[46vw] min-w-80 rounded-full opacity-45" />
      <div className="matriz-bg-orb absolute left-[8%] top-[18%] h-44 w-44 rounded-full bg-[#ffc107]/22 blur-3xl" />
      <div className="matriz-bg-orb absolute right-[10%] top-[28%] h-56 w-56 rounded-full bg-[#b45309]/16 blur-3xl" />
      <div className="matriz-pattern-kente absolute inset-0 opacity-[0.42]" />
      <div className="matriz-pattern-grain absolute inset-0 opacity-35" />
    </div>
  );
}
