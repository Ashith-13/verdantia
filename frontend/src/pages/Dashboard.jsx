import React from 'react'
import { useNavigate } from 'react-router-dom'
import { api, authDownload } from '../services/api.js'
import MapPicker from '../components/MapPicker.jsx'
import { Icons } from '../components/Icons.jsx'

const SPECIES = [
  'Azadirachta indica (Neem)',
  'Acacia nilotica (Babul)',
  'Prosopis cineraria (Khejri)',
  'Dalbergia sissoo (Shisham)',
  'Terminalia arjuna (Arjun)',
  'Tectona grandis (Teak)',
  'Syzygium cumini (Jamun)',
  'Mangifera indica (Mango)',
  'Ficus religiosa (Peepal)',
  'Casuarina equisetifolia (Casuarina)'
]

function KPI({icon,label,value}) {
  return (
    <div className='kpi'>
      <div className='icon'>{icon}</div>
      <div>
        <div className='label'>{label}</div>
        <div className='value'>{value}</div>
      </div>
    </div>
  )
}

export default function Dashboard(){
  const nav=useNavigate()
  const [user,setUser]=React.useState(()=>JSON.parse(sessionStorage.getItem('user')||'{}'))
  const [token]=React.useState(()=>sessionStorage.getItem('token'))
  const [err,setErr]=React.useState('')
  const [lat,setLat]=React.useState('12.9716')
  const [lon,setLon]=React.useState('77.5946')
  const [area,setArea]=React.useState(1000)
  const [reco,setReco]=React.useState(null)
  const [speciesChoice,setSpeciesChoice]=React.useState('Tectona grandis (Teak)')
  const [trees,setTrees]=React.useState(0)
  const [greenArea,setGreenArea]=React.useState('')
  const [project,setProject]=React.useState('My Green Site')
  const [reports,setReports]=React.useState([])
  const [uploads,setUploads]=React.useState([])
  const [leader,setLeader]=React.useState([])
  const [pendingComp,setPendingComp]=React.useState([])
  const [pendingUploads,setPendingUploads]=React.useState([])
  const [file,setFile]=React.useState(null)
  const [alert,setAlert]=React.useState(null)
  const [deleteModal,setDeleteModal]=React.useState(null)
  const [deleteReportModal,setDeleteReportModal]=React.useState(null)
  const [isSubmitting,setIsSubmitting]=React.useState(false)
  const [currentStep,setCurrentStep]=React.useState(1)
  const fileInputRef = React.useRef(null)

  const roleIsUser = (user && user.role !== 'government')
  const displayRole = roleIsUser ? 'user' : 'government'

  const showAlert = (message, type = 'error') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 5000)
  }

  React.useEffect(()=>{ if(!token){ nav('/login'); return } refreshAll() },[]) // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshAll(){
    try{
      setErr('')
      const me = await api('/api/auth/me', {token})
      sessionStorage.setItem('user', JSON.stringify(me.user))
      setUser(me.user)
      if(me.user.role !== 'government'){
        const rep=await api('/api/compliance-reports',{token})
        setReports(rep.reports||[])
        const my=await api('/api/my-videos',{token})
        setUploads(my.videos||[])
      } else {
        const p=await api('/api/admin/compliance-pending',{token})
        setPendingComp(p.reports||[])
        const u=await api('/api/admin/uploads-pending',{token})
        setPendingUploads(u.uploads||[])
      }
      const lb=await api('/api/leaderboard')
      setLeader(lb.leaderboard||[])
    }catch(e){ setErr(e.message) }
  }

  async function getReco(){
    try{
      setErr('')
      const res=await api('/api/recommendation', { method:'POST', token, body:{ lat, lon, area_sqm: area } })
      setReco(res)
    }catch(e){ setErr(e.message) }
  }

  async function submitCompliance(e){
    // Prevent default and double submission
    if(e && e.preventDefault) e.preventDefault()
    if(e && e.stopPropagation) e.stopPropagation()
    if(isSubmitting) return
    
    try{
      setIsSubmitting(true)
      setErr('')
      const body={
        project_name:project,
        area_sqm:parseFloat(area),
        trees_planned:parseInt(trees||0),
        green_area_sqm: greenArea?parseFloat(greenArea):null,
        species_choice:speciesChoice, lat, lon
      }
      const res=await api('/api/compliance-check',{method:'POST', token, body})
      await refreshAll()
      showAlert(`Submitted! Required trees: ${res.result.required_trees}. Compliant: ${res.result.compliant?'Yes':'No'}`, 'success')
    }catch(e){ 
      const errorMsg = e.message || 'Submission failed'
      setErr(errorMsg)
      showAlert(errorMsg, 'error')
    }finally{
      setIsSubmitting(false)
    }
  }

  async function deleteReport(id){
    setDeleteReportModal(null)
    try{
      await api(`/api/compliance-report/${id}`,{method:'DELETE', token})
      showAlert('Report deleted successfully!', 'success')
      await refreshAll()
    }catch(e){ 
      setErr(e.message)
      showAlert('Delete failed: ' + e.message, 'error')
    }
  }

  function confirmDeleteReport(id){
    setDeleteReportModal(id)
  }

  async function doUpload(){
    try{
      if(!file) return
      const fd=new FormData(); fd.append('file', file)
      await api('/api/upload-video',{method:'POST', token, formData:fd})
      setFile(null)
      if(fileInputRef.current) fileInputRef.current.value = ''
      showAlert('File uploaded successfully!', 'success')
      await refreshAll()
    }catch(e){ 
      setErr(e.message)
      showAlert('Upload failed: ' + e.message, 'error')
    }
  }

  async function deleteUpload(id){
    setDeleteModal(null)
    try{
      await api(`/api/upload-video/${id}`, {method:'DELETE', token})
      setFile(null)
      if(fileInputRef.current) fileInputRef.current.value = ''
      showAlert('Upload deleted successfully!', 'success')
      await refreshAll()
    }catch(e){ 
      console.error('Delete API error:', e)
      setErr('Delete failed: ' + e.message)
      showAlert('Delete failed: ' + e.message, 'error')
    }
  }

  function confirmDelete(id){
    setDeleteModal(id)
  }

  async function approveReport(id){
    try{ await api(`/api/compliance-approve/${id}`,{method:'PUT', token}); await refreshAll() }
    catch(e){ setErr(e.message) }
  }

  async function approveUpload(id){
    try{ await api(`/api/upload-approve/${id}`,{method:'PUT', token}); await refreshAll() }
    catch(e){ setErr(e.message) }
  }

  function logout(){ sessionStorage.removeItem('token'); sessionStorage.removeItem('user'); nav('/login') }

  const reqTrees = Math.max(0, Math.ceil((parseFloat(area)||0)/80))
  const pct = Math.max(0, Math.min(100, Math.round(((parseInt(trees)||0) / (reqTrees||1))*100)))

  return (
    <div className='container'>
      {/* Professional Alert Notification */}
      {alert && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          minWidth: '320px',
          maxWidth: '500px',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: alert.type === 'success' ? '#10b981' : alert.type === 'warning' ? '#f59e0b' : '#ef4444',
          color: 'white',
          animation: 'slideInRight 0.3s ease-out',
          fontWeight: '500'
        }}>
          <span style={{ fontSize: '24px' }}>
            {alert.type === 'success' ? '✓' : alert.type === 'warning' ? '⚠' : '✕'}
          </span>
          <span style={{ flex: 1 }}>{alert.message}</span>
          <button 
            onClick={() => setAlert(null)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '400px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{margin: '0 0 16px 0', color: '#1f2937'}}>Delete Upload</h3>
            <p style={{margin: '0 0 24px 0', color: '#6b7280'}}>Are you sure you want to delete this upload? This action cannot be undone.</p>
            <div style={{display: 'flex', gap: '12px', justifyContent: 'flex-end'}}>
              <button 
                onClick={() => setDeleteModal(null)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #d1d5db',
                  background: 'white',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#374151',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={() => deleteUpload(deleteModal)}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Report Confirmation Modal */}
      {deleteReportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '400px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{margin: '0 0 16px 0', color: '#1f2937'}}>Delete Compliance Report</h3>
            <p style={{margin: '0 0 24px 0', color: '#6b7280'}}>Are you sure you want to delete this compliance report? This action cannot be undone.</p>
            <div style={{display: 'flex', gap: '12px', justifyContent: 'flex-end'}}>
              <button 
                onClick={() => setDeleteReportModal(null)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #d1d5db',
                  background: 'white',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#374151',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={() => deleteReport(deleteReportModal)}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <nav>
        <div className='brand' style={{display:'flex', alignItems:'center', gap:8}}>
          <Icons.Leaf width={28} height={28} style={{color:'var(--brand)'}}/>
          <h2 style={{margin:0}}>Verdantia</h2>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:16}}>
          {roleIsUser && (
            <div style={{display:'flex', gap:12}}>
              <button 
                onClick={() => setCurrentStep(1)}
                style={{
                  padding:'8px 16px',
                  background: currentStep === 1 ? 'var(--brand)' : 'transparent',
                  color: currentStep === 1 ? 'white' : 'var(--brand)',
                  border: '1px solid var(--brand)',
                  borderRadius:'6px',
                  cursor:'pointer',
                  fontSize:'14px',
                  fontWeight:'500'
                }}
              >
                Step 1: Recommendation
              </button>
              <button 
                onClick={() => setCurrentStep(2)}
                style={{
                  padding:'8px 16px',
                  background: currentStep === 2 ? 'var(--brand)' : 'transparent',
                  color: currentStep === 2 ? 'white' : 'var(--brand)',
                  border: '1px solid var(--brand)',
                  borderRadius:'6px',
                  cursor:'pointer',
                  fontSize:'14px',
                  fontWeight:'500'
                }}
              >
                Step 2: Compliance
              </button>
              <button 
                onClick={() => setCurrentStep(3)}
                style={{
                  padding:'8px 16px',
                  background: currentStep === 3 ? 'var(--brand)' : 'transparent',
                  color: currentStep === 3 ? 'white' : 'var(--brand)',
                  border: '1px solid var(--brand)',
                  borderRadius:'6px',
                  cursor:'pointer',
                  fontSize:'14px',
                  fontWeight:'500'
                }}
              >
                Step 3: Upload & Track
              </button>
            </div>
          )}
          <div><span className='badge' style={{marginRight:10}}>{user.username} · {displayRole}</span><a onClick={logout}>Logout</a></div>
        </div>
      </nav>

      <header className='hero'>
        <h1>Plan. Plant. Prove.</h1>
        <p>Pick a spot on the map, get site-specific species guidance, submit compliance, and earn points for verified planting.</p>
      </header>

      {err && <div className='card' style={{borderColor:'#fca5a5', background:'#fff1f2'}}><b>Error:</b> {err}</div>}

      {roleIsUser && <div className='kpis'>
        <KPI label='Your Points' value={user.points ?? '—'} icon={<Icons.Trophy width={24} height={24}/>}/>
        <KPI label='Reports Submitted' value={reports.length} icon={<Icons.File width={24} height={24}/>}/>
        <KPI label='Uploads' value={uploads.length} icon={<Icons.Plant width={24} height={24}/>}/>
        <KPI label='Required Trees (calc)' value={reqTrees} icon={<Icons.Leaf width={24} height={24}/>}/>
      </div>}

      {/* STEP 1: AI Recommendation */}
      {roleIsUser && currentStep === 1 && (<>
        <div className='card section'>
          <h4><Icons.Leaf width={18} height={18}/> AI Recommendation</h4>
          <p className='subtle'>Baseline is constant; additional species adapt to climate at the selected location.</p>
          <div className='grid'>
            <div>
              <div className='grid'>
                <div><label>Latitude</label><br/><input value={lat} onChange={e=>setLat(e.target.value)}/></div>
                <div><label>Longitude</label><br/><input value={lon} onChange={e=>setLon(e.target.value)}/></div>
                <div><label>Area (sqm)</label><br/><input type='number' value={area} onChange={e=>setArea(e.target.value)}/></div>
              </div>
              <div className='map-shell'><MapPicker lat={lat} lon={lon} onChange={(a,b)=>{setLat(a); setLon(b)}}/></div>
              <div style={{marginTop:10, display:'flex', gap:8, alignItems:'center'}}>
                <button onClick={getReco}><Icons.Leaf width={16} height={16}/> Generate Recommendation</button>
                <div style={{flex:1}}>
                  <div className='subtle' style={{display:'flex', justifyContent:'space-between'}}><span>Compliance readiness</span><span>{pct}%</span></div>
                  <div className='progress'><span style={{width:`${pct}%`}}/></div>
                </div>
              </div>
            </div>
            <div>
              {!reco? <div className='card subtle'>No recommendation yet. Pick a location and click "Generate Recommendation".</div> :
                <div className='card'>
                  <p><b>NDVI (site):</b> {reco.input.ndvi}</p>
                  <p><b>Always Recommended</b></p>
                  <ul>
                    {reco.recommendation.species.map((s,i)=><li key={i}>{s}</li>)}
                  </ul>
                  <p><b>Density/Hectare:</b> {reco.recommendation.density_per_hectare}</p>
                  <p><b>Pattern:</b> {reco.recommendation.pattern}</p>
                  <p><b>Climate Band:</b> {reco.preferred_by_climate.climate_band}</p>
                  <p><b>Preferred Species for this Climate</b></p>
                  <ul>{(reco.preferred_by_climate.species||[]).map((s,i)=><li key={i}>{s}</li>)}</ul>
                </div>
              }
            </div>
          </div>
        </div>

        <div style={{marginTop:20, display:'flex', justifyContent:'flex-end'}}>
          <button onClick={()=>setCurrentStep(2)} style={{padding:'12px 24px', fontSize:'16px'}}>
            Next: Compliance Check →
          </button>
        </div>
      </>)}

      {/* STEP 2: Compliance Check */}
      {roleIsUser && currentStep === 2 && (<>
        <div className='card section'>
          <h4><Icons.File width={18} height={18}/> Compliance Check</h4>
          <p className='subtle'>Pick species and enter details. Approval generates a PDF with suitability & location guidance.</p>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', alignItems:'start'}}>
            <div style={{minWidth:0}}>
              <div className='grid'>
                <div><label>Project Name</label><br/><input value={project} onChange={e=>setProject(e.target.value)} /></div>
                <div><label>Area (sqm)</label><br/><input type='number' value={area} onChange={e=>setArea(e.target.value)} /></div>
                <div><label>Trees Planned</label><br/><input type='number' value={trees} onChange={e=>setTrees(e.target.value)} /></div>
                <div><label>Green Area (sqm, optional)</label><br/><input type='number' value={greenArea} onChange={e=>setGreenArea(e.target.value)} /></div>
                <div><label>Species</label><br/>
                  <select value={speciesChoice} onChange={e=>setSpeciesChoice(e.target.value)}>
                    {SPECIES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className='map-shell'><MapPicker lat={lat} lon={lon} onChange={(a,b)=>{setLat(a); setLon(b)}}/></div>
              <div style={{marginTop:10}}>
                <button 
                  onClick={(e) => submitCompliance(e)} 
                  disabled={isSubmitting}
                  style={{opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer'}}
                >
                  <Icons.File width={16} height={16}/> {isSubmitting ? 'Submitting...' : 'Submit Compliance'}
                </button>
              </div>
            </div>
            <div style={{minWidth:0}}>
              <div className='card' style={{height:'fit-content'}}>
                <div className='section-title'><h4>My Compliance Reports</h4></div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%', minWidth:'500px'}}>
                  <thead><tr><th>Project</th><th>Status</th><th>Req Trees</th><th>Delta</th><th>Certificate</th><th>Action</th></tr></thead>
                  <tbody>
                    {reports.map(r=>(
                      <tr key={r.id}>
                        <td>{r.project_name}</td>
                        <td>{r.status}</td>
                        <td>{r.result?.required_trees}</td>
                        <td>{r.result?.delta_trees}</td>
                        <td>
                          {r.status==='Approved'
                            ? <a onClick={()=>authDownload(`/api/compliance-certificate/${r.id}`)}>Download</a>
                            : <span className='subtle'>—</span>}
                        </td>
                        <td>
                          {r.status==='Pending' && (
                            <button 
                              onClick={()=>confirmDeleteReport(r.id)}
                              style={{background:'#198450', padding:'4px 8px', fontSize:'12px', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{marginTop:20, display:'flex', justifyContent:'space-between'}}>
          <button onClick={()=>setCurrentStep(1)} style={{padding:'12px 24px', fontSize:'16px', background:'#6b7280'}}>
            ← Back: Recommendation
          </button>
          <button onClick={()=>setCurrentStep(3)} style={{padding:'12px 24px', fontSize:'16px'}}>
            Next: Upload & Track →
          </button>
        </div>
      </>)}

      {/* STEP 3: Upload, Leaderboard & Games */}
      {roleIsUser && currentStep === 3 && (<>
        <div className='card section'>
          <h4><Icons.Plant width={18} height={18}/> Upload Planting Proof</h4>
          <p className='subtle'>Images/videos reviewed by government. Points added only after approval.</p>
          <div style={{display:'grid', gridTemplateColumns:'300px 1fr', gap:'20px', alignItems:'start'}}>
            <div style={{minWidth:0}}>
              <input 
                type='file' 
                ref={fileInputRef}
                accept='image/*,video/*'
                onChange={e=>{
                  const selectedFile = e.target.files?.[0]
                  if(selectedFile){
                    const fileType = selectedFile.type
                    const fileName = selectedFile.name.toLowerCase()
                    
                    const plantKeywords = ['plant', 'tree', 'seed', 'sapling', 'green', 'leaf', 'garden', 'forest', 'nursery', 'grow', 'vegetation', 'flora']
                    const hasPlantKeyword = plantKeywords.some(keyword => fileName.includes(keyword))
                    
                    if(!fileType.startsWith('image/') && !fileType.startsWith('video/')){
                      setFile(null)
                      e.target.value = ''
                      const errorMsg = 'Only planting images and videos are acceptable. Please upload a valid image or video file.'
                      setErr(errorMsg)
                      showAlert(errorMsg, 'error')
                    } else if(!hasPlantKeyword){
                      setFile(null)
                      e.target.value = ''
                      const errorMsg = 'File name must contain plant-related keywords (e.g., plant, tree, seed, sapling, green, leaf, garden, forest, nursery, grow, vegetation, flora).'
                      setErr(errorMsg)
                      showAlert(errorMsg, 'error')
                    } else {
                      setFile(selectedFile)
                      setErr('')
                    }
                  }
                }} 
              />
              <div style={{marginTop:10}}><button onClick={doUpload}><Icons.Plant width={16} height={16}/> Upload</button></div>
            </div>
            <div style={{minWidth:0}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%', minWidth:'600px'}}>
                <thead><tr><th>File</th><th>Status</th><th>Points</th><th>Link</th><th>Action</th></tr></thead>
                <tbody>
                  {uploads.map(u=>(
                    <tr key={u.id}>
                      <td>{u.filename}</td>
                      <td>{u.status}</td>
                      <td>{u.points_awarded}</td>
                      <td>{u.url ? <a href={u.url} target='_blank' rel='noreferrer'>Open</a> : '—'}</td>
                      <td>
                        <button 
                          onClick={()=>confirmDelete(u.id)}
                          style={{background:'#198450', padding:'4px 8px', fontSize:'12px'}}
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>

        <div className='card section'>
          <h4><Icons.Trophy width={18} height={18}/> Leaderboard</h4>
          <p className='subtle'>Only end-users are listed. Top user eligible for a cash prize (demo).</p>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', minWidth:'400px'}}>
            <thead><tr><th>#</th><th>Username</th><th>Points</th></tr></thead>
            <tbody>
              {leader.map((u,i)=>(<tr key={u.username}><td>{i+1}</td><td>{u.username}</td><td>{u.points}</td></tr>))}
            </tbody>
          </table>
          </div>

          <div style={{ marginTop: 12, display:'flex', justifyContent:'flex-end' }}>
            <button
              className="primary"
              onClick={() => nav('/vouchers')}
              aria-label="Redeem Voucher"
            >
              🎁 Redeem Voucher
            </button>
          </div>
        </div>

        <div style={{marginTop:20}}>
          <button onClick={()=>setCurrentStep(2)} style={{padding:'12px 24px', fontSize:'16px', background:'#6b7280'}}>
            ← Back: Compliance
          </button>
        </div>
      </>)}

      {!roleIsUser && (<>
        <div className='card section'>
          <h4><Icons.File width={18} height={18}/> Compliance Approvals</h4>
          <p className='subtle'>Card layout with applicant username. Approval issues a certificate with species suitability & planting location.</p>
          <div className='grid'>
            {pendingComp.map(r=>(
              <div className='gov-card' key={r.id}>
                <h4><Icons.File width={18} height={18}/> {r.project_name}</h4>
                <div className="meta"><Icons.User width={14} height={14}/> Applicant: <b>{r.username}</b></div>
                <div className="meta"><Icons.Plant width={14} height={14}/> Species: <b>{r.species_choice || '—'}</b></div>
                <div className="meta">Coords: <span className='pill'>{r.lat}, {r.lon}</span></div>
                <div style={{marginTop:10}}><button onClick={()=>approveReport(r.id)}><Icons.Shield width={14} height={14}/> Approve & Issue Certificate</button></div>
              </div>
            ))}
          </div>
        </div>

        <div className='card section'>
          <h4><Icons.Plant width={18} height={18}/> Proof Moderation</h4>
          <p className='subtle'>Approve valid uploads only. Approval credits +50 points automatically.</p>
          <table>
            <thead><tr><th>File</th><th>User</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {pendingUploads.map(u=>(
                <tr key={u.id}>
                  <td>{u.filename}</td>
                  <td>{u.user_id}</td>
                  <td>{u.status}</td>
                  <td><button onClick={()=>approveUpload(u.id)}><Icons.Shield width={14} height={14}/> Approve & Award +50</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className='card section'>
          <h4><Icons.Trophy width={18} height={18}/> Leaderboard (Users Only)</h4>
          <p className='subtle'>Recognize top contributors. Top user gets a cash prize (demo policy).</p>
          <table>
            <thead><tr><th>#</th><th>User</th><th>Points</th></tr></thead>
            <tbody>
              {leader.map((u,i)=>(<tr key={u.username}><td>{i+1}</td><td>{u.username}</td><td>{u.points}</td></tr>))}
            </tbody>
          </table>
        </div>
      </>)}

      {/* Spacer so fixed CTA doesn't overlap the last section when scrolled to end */}
      <div style={{ height: 80 }} />

      {/* Sticky CTA: visible for end-users; opens the static page directly */}
      {roleIsUser && (
        <button
          onClick={() => (window.location.href = "/green-games.html")}
          aria-label="Let's Play and Learn"
          className="cta-play-learn"
        >
          🎮 Let's Play and Learn 🌱
        </button>
      )}
    </div>
  )
}