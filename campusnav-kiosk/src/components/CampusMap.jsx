import React, { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { BUILDINGS, getWalkingPathLines, DEPARTMENTS } from '../data/buildings'
import { CAMPUS_CENTER, DEFAULT_ZOOM } from '../config'
import './CampusMap.css'

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

/** Create a custom colored marker icon */
function createIcon(color, emoji) {
    return L.divIcon({
        className: 'custom-marker',
        html: `
      <div class="marker-pin" style="--marker-color: ${color}">
        <span class="marker-emoji">${emoji}</span>
      </div>
      <div class="marker-pulse" style="--marker-color: ${color}"></div>
    `,
        iconSize: [40, 50],
        iconAnchor: [20, 50],
        popupAnchor: [0, -50],
    })
}

const MARKER_COLORS = {
    '1': '#6c63ff',
    '2': '#ff9f43',
    '3': '#ff6b6b',
    '4': '#00d4aa',
    '5': '#e056a0',
    '6': '#4da6ff',
    '7': '#ffd93d',
    '8': '#a29bfe',
}

/** MapController — handles programmatic map events */
function MapController({ center, zoom }) {
    const map = useMap()

    const handleRecenter = () => {
        map.flyTo([center.lat, center.lng], zoom, { duration: 1 })
    }

    return null
}

/** BuildingLegend side panel */
function BuildingLegend({ buildings, selectedId, onSelect }) {
    return (
        <div className="map-legend">
            <div className="legend-header">
                <span className="legend-icon">📍</span>
                <span>Campus Locations</span>
            </div>
            <div className="legend-list">
                {buildings.map((b) => (
                    <button
                        key={b.id}
                        className={`legend-item ${selectedId === b.id ? 'active' : ''}`}
                        onClick={() => onSelect(b.id)}
                    >
                        <span className="legend-item-icon">{b.icon}</span>
                        <div className="legend-item-info">
                            <span className="legend-item-title">{b.title}</span>
                            <span className="legend-item-desc">{b.description}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    )
}

export default function CampusMap() {
    const [selectedBuilding, setSelectedBuilding] = useState(null)
    const walkingPaths = getWalkingPathLines()

    const handleBuildingSelect = (id) => {
        setSelectedBuilding(id === selectedBuilding ? null : id)
    }

    // Find department info for a building
    const getDeptForBuilding = (buildingTitle) => {
        const normalizedTitle = buildingTitle.toLowerCase()
        for (const [key, dept] of Object.entries(DEPARTMENTS)) {
            const deptName = dept.name.toLowerCase();
            const deptKey = key.toLowerCase();
            
            // Match explicitly by first word, partial title, or the key itself
            if (
                normalizedTitle.includes(deptName.split(' ')[0]) || 
                normalizedTitle.includes(deptKey) ||
                deptName.includes(normalizedTitle.replace(' department', ''))
            ) {
                return dept
            }
        }
        return null
    }


    return (
        <div className="campus-map-container">
            <MapContainer
                center={[CAMPUS_CENTER.lat, CAMPUS_CENTER.lng]}
                zoom={DEFAULT_ZOOM}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                minZoom={16}
                maxZoom={20}
            >
                {/* Satellite Tile Layer */}
                <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="&copy; Esri"
                    maxZoom={20}
                />

                {/* Labels overlay for readability */}
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                    attribution=""
                    maxZoom={20}
                />

                {/* Walking path polylines */}
                {walkingPaths.map((pathCoords, i) => (
                    <Polyline
                        key={`path-${i}`}
                        positions={pathCoords}
                        pathOptions={{
                            color: '#4da6ff',
                            weight: 3,
                            opacity: 0.7,
                            dashArray: '8, 6',
                        }}
                    />
                ))}

                {/* Building Markers */}
                {BUILDINGS.map((building) => {
                    const dept = getDeptForBuilding(building.title)
                    return (
                        <Marker
                            key={building.id}
                            position={[building.coords.lat, building.coords.lng]}
                            icon={createIcon(
                                MARKER_COLORS[building.id] || '#6c63ff',
                                building.icon
                            )}
                            eventHandlers={{
                                click: () => handleBuildingSelect(building.id),
                            }}
                        >
                            <Popup className="custom-popup">
                                <div className="popup-content">
                                    <div className="popup-header">
                                        <span className="popup-icon">{building.icon}</span>
                                        <div>
                                            <h3 className="popup-title">{building.title}</h3>
                                            <p className="popup-desc">{building.description}</p>
                                        </div>
                                    </div>
                                    {dept && (
                                        <div className="popup-rooms">
                                            <span className="popup-rooms-label">Rooms:</span>
                                            <div className="popup-rooms-list">
                                                {dept.rooms.map(room => (
                                                    <span key={room} className="popup-room-tag">{room}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    )
                })}

                <MapController center={CAMPUS_CENTER} zoom={DEFAULT_ZOOM} />
            </MapContainer>

            {/* Building Legend */}
            <BuildingLegend
                buildings={BUILDINGS}
                selectedId={selectedBuilding}
                onSelect={handleBuildingSelect}
            />

            {/* Map Title Overlay */}
            <div className="map-title-overlay">
                <span className="map-title-icon">🗺️</span>
                <span className="map-title-text">Campus Map</span>
            </div>
        </div>
    )
}
