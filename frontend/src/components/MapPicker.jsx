
import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function MapPicker({lat, lon, onChange}){
  const ref = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(()=>{
    if(!ref.current) return
    if(mapRef.current) return
    const map = L.map(ref.current).setView([parseFloat(lat||0), parseFloat(lon||0)], 6)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map)
    const marker = L.marker([parseFloat(lat||0), parseFloat(lon||0)], {draggable:true}).addTo(map)
    marker.on('dragend', e=>{
      const p = e.target.getLatLng()
      onChange && onChange(p.lat.toFixed(6), p.lng.toFixed(6))
    })
    map.on('click', e=>{
      const p = e.latlng
      marker.setLatLng(p)
      onChange && onChange(p.lat.toFixed(6), p.lng.toFixed(6))
    })
    mapRef.current = map
    markerRef.current = marker
  }, [])

  useEffect(()=>{
    if(markerRef.current){
      markerRef.current.setLatLng([parseFloat(lat||0), parseFloat(lon||0)])
    }
    if(mapRef.current){
      mapRef.current.setView([parseFloat(lat||0), parseFloat(lon||0)], mapRef.current.getZoom())
    }
  }, [lat, lon])

  return <div ref={ref} style={{height:'100%', width:'100%'}}></div>
}
