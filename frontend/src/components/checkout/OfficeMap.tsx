import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useRef } from 'react'

export interface MapOffice {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
}

const PIN = { radius: 8, color: '#ffffff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }
const PIN_SELECTED = { ...PIN, radius: 11, fillColor: '#f07a32' }

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/**
 * Courier offices on an OpenStreetMap map (free, no API key). Clicking a
 * pin opens its name and address with an "Избери този офис" button.
 * Default export so CheckoutPage can lazy-load it: Leaflet is only
 * downloaded when someone actually opens the map.
 */
export default function OfficeMap({
  offices,
  selectedId,
  onSelect,
}: {
  offices: MapOffice[]
  selectedId?: string | null
  onSelect: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current, { scrollWheelZoom: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    map.setView([42.7, 25.3], 7)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    const bounds: L.LatLngExpression[] = []
    for (const office of offices) {
      const isSelected = office.id === selectedId
      const point: L.LatLngExpression = [office.latitude, office.longitude]
      bounds.push(point)
      const marker = L.circleMarker(point, isSelected ? PIN_SELECTED : PIN).addTo(layer)
      const popup = document.createElement('div')
      popup.innerHTML = `<div style="font-weight:600;margin-bottom:2px">${escapeHtml(
        office.name,
      )}</div><div style="color:#64748b;margin-bottom:8px">${escapeHtml(office.address)}</div>`
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = isSelected ? 'Избран' : 'Избери този офис'
      button.disabled = isSelected
      button.style.cssText =
        'background:#2563eb;color:#fff;border:0;border-radius:6px;padding:6px 10px;font-weight:600;cursor:pointer'
      button.addEventListener('click', () => {
        onSelectRef.current(office.id)
        map.closePopup()
      })
      popup.appendChild(button)
      marker.bindPopup(popup)
      marker.bindTooltip(office.name, { direction: 'top', offset: [0, -8] })
    }
    if (bounds.length === 1) map.setView(bounds[0], 15)
    else if (bounds.length > 1)
      map.fitBounds(L.latLngBounds(bounds), { padding: [24, 24], maxZoom: 15 })
  }, [offices, selectedId])

  return (
    <div
      ref={containerRef}
      className="h-72 w-full overflow-hidden rounded-ui border border-slate-200 sm:h-80"
      role="region"
      aria-label="Карта с офиси"
    />
  )
}
