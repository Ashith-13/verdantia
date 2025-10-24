
const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

function headers(token){
  const h = {}
  if(token) h['Authorization'] = 'Bearer '+token
  return h
}

export async function api(path, {method='GET', token, body, formData}={}){
  const opts = { method, headers: headers(token) }
  if(formData){
    opts.body = formData
  }else if(body){
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(BASE + path, opts)
  if(!res.ok){
    let msg = 'Request failed'
    try{ const j = await res.json(); msg = j.msg || JSON.stringify(j) }catch{}
    throw new Error(msg)
  }
  const txt = await res.text()
  try{ return JSON.parse(txt) }catch{ return { raw: txt } }
}

export async function authDownload(path){
  const token = sessionStorage.getItem('token')
  try{
    const res = await fetch(BASE + path, { headers: { 'Authorization': 'Bearer '+token } })
    if(res.ok){
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = (res.headers.get('Content-Disposition')||'file.pdf').split('filename=')?.[1]?.replaceAll('"','') || 'file.pdf'
      a.click()
      return
    }
  }catch{}
  window.open(BASE + path + '?token=' + encodeURIComponent(token), '_blank')
}
