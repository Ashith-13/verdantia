
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api.js'
import { Icons } from '../components/Icons.jsx'

export default function Login(){
  const nav = useNavigate()
  const [mode,setMode] = useState('login') // login | register
  const [role,setRole] = useState('user')  // user | government
  const [username,setUsername] = useState('')
  const [password,setPassword] = useState('')
  const [err,setErr] = useState('')

  async function submit(e){
    e.preventDefault()
    setErr('')
    try {
      if(mode==='register'){
        await api('/api/auth/register',{method:'POST', body:{username,password,role}})
      }
      const res = await api('/api/auth/login',{method:'POST', body:{username,password}})
      sessionStorage.setItem('token', res.token)
      sessionStorage.setItem('user', JSON.stringify(res.user))
      nav('/dashboard')
    } catch(ex){ setErr(ex.message) }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div style={{display:'flex',justifyContent:'center',marginBottom:10}}>
          <Icons.Leaf width={40} height={40} style={{color:'var(--brand)'}}/>
        </div>
        <h1 className="brand-title">Verdantia</h1>
        <p className="subtle">User & Government Access</p>
        {err && <div className="error-box">{err}</div>}

        <div style={{display:'flex',gap:8, justifyContent:'center', marginBottom:10}}>
          <button className={mode==='login'?'':'secondary'} onClick={()=>setMode('login')}>Login</button>
          <button className={mode==='register'?'':'secondary'} onClick={()=>setMode('register')}>Register</button>
        </div>

        {mode==='register' && (
          <div style={{marginBottom:8}}>
            <label style={{fontWeight:600}}>Register as</label>
            <div style={{display:'flex', gap:12, justifyContent:'center', marginTop:6}}>
              <label><input type="radio" name="role" value="user" checked={role==='user'} onChange={()=>setRole('user')} /> User</label>
              <label><input type="radio" name="role" value="government" checked={role==='government'} onChange={()=>setRole('government')} /> Government</label>
            </div>
          </div>
        )}

        <form onSubmit={submit}>
          <label><Icons.User width={16} height={16}/> Username</label>
          <input value={username} onChange={e=>setUsername(e.target.value)} required />

          <label><Icons.Shield width={16} height={16}/> Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required />

          <button type="submit">
            {mode==='login' ? (<><Icons.Leaf width={16} height={16}/> Login</>) : (<><Icons.Leaf width={16} height={16}/> Create Account</>)}
          </button>
        </form>

        <div className="login-note subtle">
          After login, role is auto-detected from your account.
        </div>
      </div>
    </div>
  )
}
