import React from "react"
import { Icons } from "../components/Icons.jsx"

// --- Shared Styles (inline to keep this self-contained) ---
const pill = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 999,
  background: "var(--surface, #f0fdf4)",
  color: "var(--brand, #16a34a)",
  fontSize: 12,
  fontWeight: 600,
  border: "1px solid #dcfce7",
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
      {tabs.map(t => (
        <button key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            padding: "10px 16px",
            borderRadius: 12,
            border: "1px solid #d1fae5",
            background: active===t.key ? "linear-gradient(90deg,#16a34a,#22c55e)" : "#fff",
            color: active===t.key ? "#fff" : "#14532d",
            fontWeight: 700,
            cursor: "pointer"
          }}>
          {t.icon}{' '}{t.label}
        </button>
      ))}
    </div>
  )
}

/** ------------------------------
 * GAME 1: Tree Match Quiz (Memory)
 * Match species ↔ benefits. Flip pairs.
 * ------------------------------ */
function TreeMatchQuiz() {
  const PAIRS = React.useMemo(()=> ([
    ["Azadirachta indica (Neem)", "Air purification"],
    ["Ficus religiosa (Peepal)", "Night-time O₂ release"],
    ["Syzygium cumini (Jamun)", "Urban biodiversity"],
    ["Mangifera indica (Mango)", "Shade + fruit"],
    ["Dalbergia sissoo (Shisham)", "Soil binding"],
    ["Prosopis cineraria (Khejri)", "Arid resilience"],
  ]), [])

  const deck = React.useMemo(() => {
    const cards = []
    PAIRS.forEach(([l,r], idx) => {
      cards.push({ id:`l-${idx}`, pair: idx, text:l, type:"L" })
      cards.push({ id:`r-${idx}`, pair: idx, text:r, type:"R" })
    })
    // shuffle
    for (let i=cards.length-1;i>0;i--) {
      const j = Math.floor(Math.random()* (i+1))
      ;[cards[i], cards[j]] = [cards[j], cards[i]]
    }
    return cards
  // regenerate once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [flipped, setFlipped] = React.useState([])
  const [matched, setMatched] = React.useState(new Set())
  const [moves, setMoves] = React.useState(0)
  const [facts, setFacts] = React.useState([])

  function onFlip(card) {
    if (matched.has(card.id) || flipped.find(c=>c.id===card.id)) return
    if (flipped.length === 0) setFlipped([card])
    else if (flipped.length === 1) {
      const [a] = flipped
      const next = [a, card]
      setFlipped(next)
      setMoves(m => m+1)
      if (a.pair === card.pair && a.type !== card.type) {
        // match
        const newMatched = new Set([...matched, a.id, card.id])
        setMatched(newMatched)
        setFacts(f => [...f, `Unlocked: ${PAIRS[a.pair][0]} → ${PAIRS[a.pair][1]}`])
        setTimeout(()=> setFlipped([]), 600)
      } else {
        setTimeout(()=> setFlipped([]), 750)
      }
    }
  }

  const allDone = matched.size === deck.length

  return (
    <div className="card section">
      <div className="section-title" style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
        <h4><Icons.Leaf width={18} height={18}/> Tree Match Quiz</h4>
        <span style={pill}>Moves: {moves}</span>
      </div>
      <p className="subtle">Flip two cards. Match a species to its benefit to earn a fun fact.</p>

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fill, minmax(180px,1fr))",
        gap:12
      }}>
        {deck.map(card=>{
          const isFaceUp = flipped.find(c=>c.id===card.id) || matched.has(card.id)
          return (
            <button
              key={card.id}
              onClick={()=>onFlip(card)}
              disabled={isFaceUp}
              style={{
                padding:"16px",
                minHeight:90,
                borderRadius:12,
                textAlign:"left",
                background: isFaceUp ? "#ecfdf5" : "#ffffff",
                color: "#064e3b",
                border:"1px solid #d1fae5",
                boxShadow: isFaceUp ? "inset 0 0 0 2px #34d399" : "0 1px 2px rgba(0,0,0,0.05)",
                cursor: isFaceUp ? "default" : "pointer",
                fontWeight:600
              }}
            >
              {isFaceUp ? card.text : "Flip"}
            </button>
          )
        })}
      </div>

      <div className="card" style={{marginTop:16}}>
        <h4>Unlocked Facts</h4>
        {facts.length === 0 ? <p className="subtle">Match pairs to unlock facts.</p> :
          <ul>{facts.map((f,i)=><li key={i}>{f}</li>)}</ul>}
      </div>

      {allDone && (
        <div className="card" style={{marginTop:16, borderColor:"#86efac", background:"#f0fdf4"}}>
          <b>All pairs matched!</b> You’ve mastered species↔benefits mapping. 🌱
        </div>
      )}
    </div>
  )
}

/** ------------------------------------
 * GAME 2: Plant & Survive (Drag & Drop)
 * Drop species onto the plot. Native -> grows; Invasive -> dies.
 * ------------------------------------ */
function PlantAndSurvive() {
  // basic demo lists; tune per-region later or fetch from backend if needed
  const NATIVE = new Set([
    "Azadirachta indica (Neem)",
    "Acacia nilotica (Babul)",
    "Prosopis cineraria (Khejri)",
    "Dalbergia sissoo (Shisham)",
    "Terminalia arjuna (Arjun)",
    "Syzygium cumini (Jamun)",
    "Mangifera indica (Mango)",
    "Ficus religiosa (Peepal)"
  ])

  const INVASIVE = new Set([
    "Casuarina equisetifolia (Casuarina)", // region-sensitive; treat as invasive for demo
    "Leucaena leucocephala (Subabul)",
    "Prosopis juliflora (Vilayati babul)"
  ])

  const ALL = Array.from(new Set([...NATIVE, ...INVASIVE]))
  const [score, setScore] = React.useState(0)
  const [lives, setLives] = React.useState(3)
  const [log, setLog] = React.useState([])
  const [plot, setPlot] = React.useState([]) // {x,y,species,ok}

  function onDragStart(e, species) {
    e.dataTransfer.setData("text/plain", species)
  }

  function onDrop(e) {
    e.preventDefault()
    const species = e.dataTransfer.getData("text/plain")
    if (!species) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(( (e.clientX - rect.left) / rect.width ) * 100)
    const y = Math.round(( (e.clientY - rect.top) / rect.height ) * 100)
    const ok = NATIVE.has(species)
    const msg = ok ? `✅ ${species} is native. It grows! (+10)` : `❌ ${species} may be invasive here. It dies. (-1 life)`
    setPlot(p => [...p, { x, y, species, ok }])
    setLog(l => [msg, ...l].slice(0,8))
    if (ok) setScore(s => s+10)
    else setLives(lv => Math.max(0, lv-1))
  }

  function reset() { setScore(0); setLives(3); setLog([]); setPlot([]) }

  const gameOver = lives === 0

  return (
    <div className="card section">
      <div className="section-title" style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
        <h4><Icons.Plant width={18} height={18}/> Plant & Survive</h4>
        <div style={{display:"flex", gap:8}}>
          <span style={pill}>Score: {score}</span>
          <span style={pill}>Lives: {lives}</span>
          <button onClick={reset} style={{...pill, background:"#fff", border:"1px solid #bbf7d0", color:"#065f46"}}>Reset</button>
        </div>
      </div>
      <p className="subtle">Drag a species and drop it on the plot. Native = 🌱 grows; Invasive = ☠ dies.</p>

      <div style={{display:"grid", gridTemplateColumns:"260px 1fr", gap:12}}>
        {/* Species palette */}
        <div className="card" style={{maxHeight:420, overflow:"auto"}}>
          <h4>Species</h4>
          <div style={{display:"grid", gap:8}}>
            {ALL.map(s => (
              <div key={s}
                   draggable
                   onDragStart={(e)=>onDragStart(e,s)}
                   title="Drag me to the plot"
                   style={{
                     padding:"10px 12px",
                     border:"1px solid #d1fae5",
                     borderRadius:10,
                     background:"#ffffff",
                     cursor:"grab",
                     display:"flex",
                     alignItems:"center",
                     justifyContent:"space-between",
                     gap:8
                   }}>
                <span style={{fontWeight:600, color:"#064e3b"}}>{s}</span>
                {NATIVE.has(s) ? <Icons.Leaf width={16} height={16} style={{color:"#16a34a"}}/> : <Icons.Shield width={16} height={16} style={{color:"#ef4444"}}/>}
              </div>
            ))}
          </div>
        </div>

        {/* Plot */}
        <div>
          <div
            onDragOver={e=>e.preventDefault()}
            onDrop={onDrop}
            style={{
              height:420,
              border:"2px dashed #a7f3d0",
              borderRadius:16,
              background: "linear-gradient(180deg,#ecfdf5,#ffffff)",
              position:"relative"
            }}
          >
            {plot.map((p,idx)=>(
              <div key={idx}
                   style={{
                     position:"absolute",
                     left:`calc(${p.x}% - 10px)`,
                     top:`calc(${p.y}% - 10px)`,
                     width:20, height:20,
                     borderRadius:"50%",
                     background: p.ok ? "#16a34a" : "#ef4444",
                     boxShadow: "0 0 0 2px #fff"
                   }}
                   title={`${p.species} @ ${p.x}%, ${p.y}%`} />
            ))}
            {gameOver && (
              <div style={{
                position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
                background:"rgba(0,0,0,0.4)", color:"#fff", borderRadius:16, textAlign:"center", padding:20
              }}>
                <div>
                  <h3>Game Over</h3>
                  <p>Your final score: {score}. Try planting more native species!</p>
                  <button onClick={reset} style={{
                    padding:"10px 16px", borderRadius:12, border:"none",
                    background:"linear-gradient(90deg,#16a34a,#22c55e)", color:"#fff", fontWeight:700, cursor:"pointer"
                  }}>Play Again</button>
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{marginTop:12}}>
            <h4>Events</h4>
            {log.length === 0 ? <p className="subtle">Drop a species to get started.</p> :
              <ul style={{margin:0, paddingLeft:18}}>{log.map((m,i)=><li key={i}>{m}</li>)}</ul>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Games(){
  const [tab, setTab] = React.useState("plant")
  const tabs = [
    { key:"plant", label:"Plant & Survive", icon:<Icons.Plant width={16} height={16}/> },
    { key:"match", label:"Tree Match Quiz", icon:<Icons.Leaf width={16} height={16}/> },
  ]

  return (
    <div className="container">
      <nav>
        <div className='brand' style={{display:'flex', alignItems:'center', gap:8}}>
          <Icons.Leaf width={28} height={28} style={{color:'var(--brand)'}}/>
          <h2 style={{margin:0}}>Verdantia</h2>
        </div>
        <div><a href="/dashboard">Back to Dashboard</a></div>
      </nav>

      <header className='hero'>
        <h1>Fun & Learn</h1>
        <p>Engage. Educate. Level-up your native species intuition.</p>
      </header>

      <div className="card section">
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
          <h4><Icons.Trophy width={18} height={18}/> Games Hub</h4>
          <span style={pill}>White + Green Theme</span>
        </div>
        <p className="subtle">Two bite-sized games that reinforce smart planting decisions.</p>
        <Tabs tabs={tabs} active={tab} onChange={setTab}/>
      </div>

      {tab==="plant" ? <PlantAndSurvive/> : <TreeMatchQuiz/>}
    </div>
  )
}
