import React, { useState, useRef, useEffect } from 'react'
import { API_BASE_URL } from '../config'
import './Chatbot.css'

const API_URL = `${API_BASE_URL}/api/chat`

const SUGGESTIONS = [
    "Who is the HOD of CSE?",
    "Which bus goes to Kottarakara?",
    "Who is the Principal?",
    "Tell me about BME department",
    "Where is Dr. Nijil?",
]

export default function Chatbot() {
    const [messages, setMessages] = useState([
        {
            id: '1',
            text: "Hello! I'm your Campus Assistant. Ask me anything about faculty, departments, or campus navigation.",
            sender: 'bot',
            timestamp: new Date(),
        },
    ])
    const [inputText, setInputText] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef(null)
    const inputRef = useRef(null)

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isTyping])

    const sendMessage = async (text) => {
        const trimmed = (text || inputText).trim()
        if (!trimmed) return

        // Add user message
        const userMsg = {
            id: Date.now().toString(),
            text: trimmed,
            sender: 'user',
            timestamp: new Date(),
        }
        setMessages(prev => [...prev, userMsg])
        setInputText('')
        setIsTyping(true)

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: trimmed }),
            })

            const data = await response.json()

            let replyText = ''
            if (typeof data.reply === 'string') {
                replyText = data.reply
            } else if (data.reply) {
                replyText = JSON.stringify(data.reply, null, 2)
            } else if (data.error) {
                replyText = data.error
            } else {
                replyText = "I received your message but couldn't generate a response."
            }

            const botMsg = {
                id: (Date.now() + 1).toString(),
                text: replyText,
                sender: 'bot',
                timestamp: new Date(),
            }
            setMessages(prev => [...prev, botMsg])
        } catch (error) {
            console.error('[Chatbot API Error]:', error)
            const errorMsg = {
                id: (Date.now() + 1).toString(),
                text: "Sorry, I couldn't connect to the server. Please check the connection and try again.",
                sender: 'bot',
                timestamp: new Date(),
            }
            setMessages(prev => [...prev, errorMsg])
        } finally {
            setIsTyping(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const handleSuggestionClick = (suggestion) => {
        sendMessage(suggestion)
    }

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        })
    }

    const showSuggestions = messages.length <= 1 && !isTyping

    return (
        <div className="chatbot-container">
            {/* Header */}
            <div className="chatbot-header">
                <div className="chatbot-header-info">
                    <div className="chatbot-avatar">
                        <span className="chatbot-avatar-icon">🤖</span>
                        <span className="chatbot-avatar-status"></span>
                    </div>
                    <div>
                        <h2 className="chatbot-header-title">Campus Assistant</h2>
                        <p className="chatbot-header-subtitle">AI-Powered • Always Ready</p>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="chatbot-messages">
                {messages.map((msg, index) => (
                    <div
                        key={msg.id}
                        className={`message-wrapper ${msg.sender === 'user' ? 'user' : 'bot'}`}
                        style={{ animationDelay: `${index * 0.05}s` }}
                    >
                        {msg.sender === 'bot' && (
                            <div className="message-avatar-small">🤖</div>
                        )}
                        <div className={`message-bubble ${msg.sender}`}>
                            <p className="message-text">{msg.text}</p>
                            <span className="message-time">{formatTime(msg.timestamp)}</span>
                        </div>
                    </div>
                ))}

                {/* Typing Indicator */}
                {isTyping && (
                    <div className="message-wrapper bot typing-wrapper">
                        <div className="message-avatar-small">🤖</div>
                        <div className="typing-indicator">
                            <span className="typing-dot" style={{ animationDelay: '0s' }}></span>
                            <span className="typing-dot" style={{ animationDelay: '0.15s' }}></span>
                            <span className="typing-dot" style={{ animationDelay: '0.3s' }}></span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Suggestion Chips */}
            {showSuggestions && (
                <div className="suggestions-container">
                    <p className="suggestions-label">Try asking:</p>
                    <div className="suggestions-grid">
                        {SUGGESTIONS.map((s, i) => (
                            <button
                                key={i}
                                className="suggestion-chip"
                                onClick={() => handleSuggestionClick(s)}
                                style={{ animationDelay: `${0.3 + i * 0.08}s` }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="chatbot-input-area">
                <div className="chatbot-input-wrapper">
                    <textarea
                        ref={inputRef}
                        className="chatbot-input"
                        placeholder="Which bus will take me to Kottarakara?"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        maxLength={500}
                    />
                    <button
                        className={`chatbot-send-btn ${inputText.trim() ? 'active' : ''}`}
                        onClick={() => sendMessage()}
                        disabled={!inputText.trim()}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    )
}
