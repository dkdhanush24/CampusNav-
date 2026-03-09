import React, { useState, useEffect } from 'react'
import CampusMap from './components/CampusMap'
import Chatbot from './components/Chatbot'

export default function App() {
    const [activeModule, setActiveModule] = useState(null)
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])

    const formattedTime = currentTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    })

    const formattedDate = currentTime.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    })

    const handleBack = () => setActiveModule(null)

    // ── Full-screen Map Module ──
    if (activeModule === 'map') {
        return (
            <div className="app-container">
                <header className="app-header module-header">
                    <div className="header-brand">
                        <button className="back-btn" onClick={handleBack} title="Back to Home">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>
                        <div className="header-logo-mini">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                                <line x1="8" y1="2" x2="8" y2="18"></line>
                                <line x1="16" y1="6" x2="16" y2="22"></line>
                            </svg>
                        </div>
                        <div>
                            <div className="header-title">Campus Map</div>
                            <div className="header-subtitle">Satellite Navigation</div>
                        </div>
                    </div>
                    <div className="header-status">
                        <div className="status-indicator">
                            <span className="status-dot"></span>
                            Live
                        </div>
                    </div>
                </header>
                <main className="module-fullscreen">
                    <CampusMap />
                </main>
            </div>
        )
    }

    // ── Full-screen Chatbot Module ──
    if (activeModule === 'chat') {
        return (
            <div className="app-container">
                <header className="app-header module-header">
                    <div className="header-brand">
                        <button className="back-btn" onClick={handleBack} title="Back to Home">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>
                        <div className="header-logo-mini chat-logo">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </div>
                        <div>
                            <div className="header-title">Campus Assistant</div>
                            <div className="header-subtitle">AI-Powered</div>
                        </div>
                    </div>
                    <div className="header-status">
                        <div className="status-indicator">
                            <span className="status-dot"></span>
                            Online
                        </div>
                    </div>
                </header>
                <main className="module-fullscreen">
                    <Chatbot />
                </main>
            </div>
        )
    }

    // ── Home Screen ──
    return (
        <div className="app-container home-app">
            {/* Animated background */}
            <div className="home-bg">
                <div className="home-orb home-orb-1"></div>
                <div className="home-orb home-orb-2"></div>
                <div className="home-orb home-orb-3"></div>
                <div className="home-grid-overlay"></div>
            </div>

            {/* Top bar */}
            <div className="home-topbar">
                <div className="home-topbar-left">
                    <div className="home-logo-mark">
                        <span>CN</span>
                    </div>
                    <span className="home-topbar-label">CampusNav Kiosk</span>
                </div>
                <div className="home-topbar-right">
                    <div className="home-live-badge">
                        <span className="home-live-dot"></span>
                        System Active
                    </div>
                </div>
            </div>

            {/* Center content */}
            <main className="home-center">
                {/* Clock */}
                <div className="home-clock">
                    <span className="home-clock-time">{formattedTime}</span>
                    <span className="home-clock-date">{formattedDate}</span>
                </div>

                {/* Title */}
                <div className="home-title-block">
                    <h1 className="home-title">
                        <span className="home-title-line1">Welcome to</span>
                        <span className="home-title-line2">CampusNav</span>
                    </h1>
                    <p className="home-tagline">Your intelligent campus navigation system</p>
                </div>

                {/* Module Cards */}
                <div className="home-cards">
                    <button className="home-card" onClick={() => setActiveModule('map')}>
                        <div className="home-card-shine"></div>
                        <div className="home-card-inner">
                            <div className="home-card-icon-wrap map-wrap">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                                    <line x1="8" y1="2" x2="8" y2="18"></line>
                                    <line x1="16" y1="6" x2="16" y2="22"></line>
                                </svg>
                            </div>
                            <div className="home-card-text">
                                <h2>Campus Map</h2>
                                <p>Interactive satellite navigation with live building markers</p>
                            </div>
                            <div className="home-card-cta">
                                <span>Explore</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                    <polyline points="12 5 19 12 12 19"></polyline>
                                </svg>
                            </div>
                        </div>
                    </button>

                    <button className="home-card" onClick={() => setActiveModule('chat')}>
                        <div className="home-card-shine"></div>
                        <div className="home-card-inner">
                            <div className="home-card-icon-wrap chat-wrap">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                    <line x1="9" y1="9" x2="15" y2="9"></line>
                                    <line x1="9" y1="13" x2="13" y2="13"></line>
                                </svg>
                            </div>
                            <div className="home-card-text">
                                <h2>AI Assistant</h2>
                                <p>Ask about faculty, departments & campus info</p>
                            </div>
                            <div className="home-card-cta">
                                <span>Ask Now</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                    <polyline points="12 5 19 12 12 19"></polyline>
                                </svg>
                            </div>
                        </div>
                    </button>
                </div>

                <p className="home-hint">Select a module to begin</p>
            </main>
        </div>
    )
}
