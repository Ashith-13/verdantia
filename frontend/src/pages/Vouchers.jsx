// src/pages/Vouchers.jsx
import React from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../services/api.js"

const VOUCHERS = [
  { id: "V50",  brand: "Cafe Verde",      value: 50,  desc: "Rs. 50 off — beverages" },
  { id: "V75",  brand: "Eco Mart",        value: 75,  desc: "Rs. 75 off — groceries" },
  { id: "V100", brand: "Green Bites",     value: 100, desc: "Rs. 100 off — snacks" },
  { id: "V120", brand: "Leaf n’ Learn",   value: 120, desc: "Rs. 120 off — books" },
  { id: "V150", brand: "Urban Forest",    value: 150, desc: "Rs. 150 off — apparel" },
  { id: "V200", brand: "Planet Play",     value: 200, desc: "Rs. 200 off — games" },
]

export default function Vouchers(){
  const nav = useNavigate()
  const [token] = React.useState(() => sessionStorage.getItem("token"))
  const [user, setUser] = React.useState(() => JSON.parse(sessionStorage.getItem("user") || "{}"))
  const [busy, setBusy] = React.useState(null) // voucher id in-flight
  const [err, setErr] = React.useState("")

  async function redeem(v){
    if (!token) { nav("/login"); return }
    if ((user.points ?? 0) < v.value) {
      setErr("Not enough points to redeem this voucher.")
      return
    }

    setErr("")
    setBusy(v.id)

    // Optimistic UI: deduct points locally
    const prevUser = { ...user }
    const nextUser = { ...user, points: (user.points || 0) - v.value }
    setUser(nextUser)
    sessionStorage.setItem("user", JSON.stringify(nextUser))

    try{
      // Backend call (implement server to persist + issue code)
      // Expected request body: { voucher_id, cost }
      const res = await api("/api/redeem-voucher", {
        method: "POST",
        token,
        body: { voucher_id: v.id, cost: v.value }
      })
      // Optional: show returned code if backend sends one
      const code = res?.code || res?.voucher_code
      const msg = code
        ? `Redeemed ${v.brand} ₹${v.value}. Code: ${code}`
        : `Redeemed ${v.brand} ₹${v.value}.`
      alert(msg)
    }catch(e){
      // Roll back on failure
      setUser(prevUser)
      sessionStorage.setItem("user", JSON.stringify(prevUser))
      setErr(e.message || "Redemption failed. Please try again.")
    }finally{
      setBusy(null)
    }
  }

  return (
    <div className="container">
      <nav>
        <div className='brand' style={{display:'flex', alignItems:'center', gap:8}}>
          <h2 style={{margin:0}}>Vouchers</h2>
        </div>
        <div>
          <span className="badge" style={{ marginRight: 10 }}>
            Points: <b style={{ marginLeft: 6 }}>{user.points ?? "—"}</b>
          </span>
          <a onClick={() => nav("/dashboard")}>Back</a>
        </div>
      </nav>

      <header className="hero">
        <h1>Redeem your points</h1>
        <p>Pick a partner voucher. Your points will be debited immediately.</p>
      </header>

      {err && (
        <div className="card" style={{borderColor:'#fca5a5', background:'#fff1f2'}}>
          <b>Error:</b> {err}
        </div>
      )}

      <div className="card section">
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {VOUCHERS.map(v => {
            const insufficient = (user.points ?? 0) < v.value
            const isBusy = busy === v.id
            return (
              <div key={v.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <h4 style={{ margin: 0 }}>{v.brand}</h4>
                  <span className="pill">₹{v.value}</span>
                </div>
                <p className="subtle" style={{ margin: 0 }}>{v.desc}</p>
                <div style={{ display:"flex", gap:8, marginTop:8 }}>
                  <button
                    className="primary"
                    disabled={insufficient || isBusy}
                    onClick={() => redeem(v)}
                    aria-label={`Redeem ${v.brand} ${v.value}`}
                  >
                    {isBusy ? "Redeeming..." : "Redeem"}
                  </button>
                  {insufficient && <span className="subtle">Not enough points</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
