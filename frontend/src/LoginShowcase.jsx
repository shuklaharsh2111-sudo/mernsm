// Centre piece of the login left box, drawn over the red neon ribbons: a glowing aura built from
// light and neon line work. A bright core inside a spinning wireframe globe, sunburst rays,
// dashed rings with travelling dots, ripples and drifting sparks.
// Pure CSS / SVG animation, so it costs nothing next to the three.js background.

const C = 200; // centre of the 400 x 400 drawing
const R = 88; // globe radius
const TILT = (18 * Math.PI) / 180;

// 6 meridians (their width swings 1 -> -1 so the globe seems to turn) and 5 latitude lines
const MERIDIANS = [0, 1, 2, 3, 4, 5];
const LATITUDES = [-60, -30, 0, 30, 60].map((deg) => {
  const a = (deg * Math.PI) / 180;
  const rx = R * Math.cos(a);
  return { rx, ry: rx * Math.sin(TILT), cy: C - R * Math.sin(a) * Math.cos(TILT) };
});

// x / y are % positions inside the aura box, d = float duration (s), s = size (px), t = start delay (s)
const SPARKS = [
  { x: 12, y: 30, d: 7, s: 4, t: 0 },
  { x: 24, y: 72, d: 9, s: 3, t: 1.2 },
  { x: 38, y: 12, d: 8, s: 5, t: 2.4 },
  { x: 62, y: 8, d: 10, s: 3, t: 0.6 },
  { x: 80, y: 26, d: 7.5, s: 4, t: 3.1 },
  { x: 90, y: 58, d: 9.5, s: 3, t: 1.8 },
  { x: 74, y: 84, d: 8.5, s: 5, t: 0.9 },
  { x: 50, y: 92, d: 11, s: 3, t: 2.8 },
  { x: 30, y: 50, d: 6.5, s: 2, t: 3.6 },
  { x: 68, y: 48, d: 7, s: 2, t: 1.5 },
  { x: 8, y: 56, d: 10, s: 3, t: 4.2 },
  { x: 55, y: 28, d: 8, s: 2, t: 0.3 },
];

const LoginShowcase = () => (
  <div className="nl-show">
    <div className="nl-aura">
      <span className="nl-aura-halo" />
      <span className="nl-aura-rays" />
      <span className="nl-aura-wave" style={{ '--w': '0s' }} />
      <span className="nl-aura-wave" style={{ '--w': '3s' }} />
      <span className="nl-aura-swirl" />
      <span className="nl-aura-orb" />
      <span className="nl-aura-core" />

      <svg className="nl-lines" viewBox="0 0 400 400" aria-hidden="true">
        {/* neon rings */}
        <circle className="nl-ln nl-r-a" cx={C} cy={C} r="192" />
        <circle className="nl-ln nl-r-b" cx={C} cy={C} r="170" />
        <circle className="nl-ln nl-r-c" cx={C} cy={C} r="148" />
        <circle className="nl-ln nl-r-d" cx={C} cy={C} r="126" />

        {/* dots travelling on the rings */}
        <g className="nl-dot nl-dot-a"><circle cx={C} cy="8" r="4.5" /></g>
        <g className="nl-dot nl-dot-b"><circle cx={C} cy="30" r="3.5" /></g>
        <g className="nl-dot nl-dot-c"><circle cx={C} cy="52" r="3" /></g>

        {/* wireframe globe */}
        <g className="nl-globe">
          {LATITUDES.map((l, i) => (
            <ellipse key={i} className="nl-gl" cx={C} cy={l.cy} rx={l.rx} ry={l.ry} />
          ))}
          {MERIDIANS.map((i) => (
            <ellipse key={i} className="nl-gl nl-mer" cx={C} cy={C} rx={R} ry={R} style={{ animationDelay: `${-i * 2}s` }} />
          ))}
          <circle className="nl-gl nl-rim" cx={C} cy={C} r={R} />
        </g>
      </svg>

      {SPARKS.map((p, i) => (
        <i
          key={i}
          className="nl-spark"
          style={{ left: `${p.x}%`, top: `${p.y}%`, '--d': `${p.d}s`, '--s': `${p.s}px`, '--t': `${p.t}s` }}
        />
      ))}
    </div>
  </div>
);

export default LoginShowcase;
