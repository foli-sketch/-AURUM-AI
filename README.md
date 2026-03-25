# 🔶 Aura Terminal Pro

> **Professional Gold (XAUUSD) Trading Signal System**  
> Real-time analysis · AI-powered insights · Smart Money Concepts · Multi-timeframe confluence

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-2.x-000000?style=flat-square&logo=flask&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-Llama_3.3-F55036?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square)

---

## 📌 Overview

**Aura Terminal Pro** is a production-grade Gold trading signal application that combines classical technical analysis, Smart Money Concepts (SMC), multi-timeframe confluence, and AI-powered market interpretation to generate high-confidence BUY/SELL/HOLD signals for XAUUSD (Gold/USD).

Built for traders who demand precision — every signal requires a minimum score of 7/20 across multiple confirmation layers before execution is recommended.

---

## ✨ Features

### 📊 Live Data Engine
- Real-time XAUUSD price via `yfinance` (GC=F ticker)
- 6 timeframes: **5M · 15M · 30M · 1H · 4H · 1D**
- Auto-refresh every 60 seconds with countdown timer

### 📈 Technical Indicators (38 total)

| Category | Indicators |
|---|---|
| **Trend** | EMA 8/21/50/200, SMA 20/50, MACD, ADX, Parabolic SAR, Ichimoku Cloud |
| **Momentum** | RSI, StochRSI K/D, Stochastic, CCI, Williams %R, ROC |
| **Volatility** | ATR, Bollinger Bands, Keltner Channel, Donchian Channel |
| **Volume** | OBV, MFI, CMF, VWAP |

### 🏦 Smart Money Concepts (SMC)
- **Order Block** detection (Bullish & Bearish)
- **Fair Value Gap (FVG)** identification
- **Liquidity Pools** — Equal Highs/Lows mapping

### 🕯️ Candlestick Pattern Recognition
Doji · Hammer · Shooting Star · Bullish/Bearish Engulfing · Marubozu · Morning Star · Evening Star

### 📉 Divergence Detection
- RSI Divergence (Bullish/Bearish)
- MACD Divergence (Bullish/Bearish)

### 🌍 Multi-Timeframe Confluence (MTF)
Simultaneously analyzes **1H + 4H + 1D** to determine overall market bias

### ⏰ Session Intelligence
- London Session (08:00–16:00 UTC)
- New York Session (13:00–21:00 UTC)
- London+NY Overlap detection
- OFF-HOURS warning (no trade recommendation)

### 🎯 Signal Engine
- Score-based system (**0–20 points**)
- Confidence meter (%)
- Entry · Stop Loss · TP1 · TP2 · TP3
- Risk/Reward ratio calculation
- Full confirmation list explaining *why* the signal fired

### 📊 Visual Analysis Chart (Plotly)
- Interactive candlestick chart
- EMA lines overlay
- Bollinger Bands visualization
- Auto-drawn Support/Resistance levels
- Order Block & FVG zones highlighted
- Pattern labels on candles
- BUY ▲ / SELL ▼ signal markers
- Entry · SL · TP lines drawn
- RSI · MACD · Volume subplots

### 🤖 AI-Powered Analysis
- **Groq AI** (Llama 3.3 70B) for market interpretation
- "Why This Signal?" — detailed breakdown
- **Live Chat** with full market context injected
- Quick action prompts for instant insights

### 📰 Market News Feed
- Live Gold news from Yahoo Finance & Kitco
- Auto-sentiment tagging: BULLISH / BEARISH / NEUTRAL

### 📡 Telegram Integration
- Instant signal broadcast to Telegram bot
- Full signal details: Entry, SL, TP1–3, Confirmations, AI analysis
- One-click broadcast from dashboard

---

## 🛠️ Tech Stack

```
Backend   →  Python 3.10+ · Flask · Flask-CORS
Data      →  yfinance · pandas · numpy
Analysis  →  ta (Technical Analysis Library) · Plotly
AI        →  Groq API (llama-3.3-70b-versatile)
News      →  feedparser · requests
Alerts    →  Telegram Bot API
Frontend  →  HTML5 · CSS3 · Vanilla JS · Plotly.js
Hosting   →  Replit (deployable anywhere)
```

---

## 🚀 Getting Started

### Prerequisites
```bash
Python 3.10+
pip
```

### Installation

```bash
# Clone the repository
git clone https://github.com/foli-sketch/aura-terminal-pro.git
cd aura-terminal-pro

# Install dependencies
pip install flask flask-cors yfinance pandas numpy ta \
            requests feedparser plotly python-dateutil pytz
```

### Configuration

Open `app.py` and set your API keys:

```python
GROQ_KEY  = "your_groq_api_key"
TG_TOKEN  = "your_telegram_bot_token"
TG_CHAT   = "your_telegram_chat_id"
```

> ⚠️ **Security Note:** Never commit real API keys to a public repository. Use environment variables in production.

### Run

```bash
python app.py
```

Open your browser: `http://localhost:5000`

---

## 📁 Project Structure

```
aura-terminal-pro/
│
├── app.py                  # Main Flask backend
│   ├── /api/data           # Live price + all indicators + signal
│   ├── /api/chart          # Plotly visual analysis chart
│   ├── /api/news           # Gold market news feed
│   ├── /api/chat           # Groq AI live chat
│   ├── /api/analysis       # AI signal explanation
│   └── /api/telegram       # Telegram broadcast
│
├── templates/
│   └── index.html          # Full trading dashboard UI
│
└── README.md
```

---

## 📸 Screenshots

| Dashboard | Chart Analysis |
|---|---|
| Signal · Indicators · SMC | Candlestick · S/R · Patterns |

---

## 🧠 Signal Logic

A signal is generated only when the score threshold is met:

```
BUY  → bull_score >= 7  AND  bull_score > bear_score
SELL → bear_score >= 7  AND  bear_score > bull_score
HOLD → Neither threshold met
```

**Scoring Criteria (max 20 points):**
- EMA Bullish/Bearish Stack → +2
- MACD Cross → +1
- ADX Trend Strength → +1
- Ichimoku Cloud Position → +1
- Parabolic SAR → +1
- RSI Zone → +1
- StochRSI Cross → +1
- CCI Direction → +1
- Order Block proximity → +2
- RSI Divergence → +2
- MACD Divergence → +2
- Money Flow (CMF) → +1
- Candlestick Pattern → +1
- MTF Confluence → +2
- Active Session → +1

---

## ⚠️ Disclaimer

> This application is built for **educational and research purposes only**.  
> It does **not** constitute financial advice.  
> Always conduct your own analysis before making trading decisions.  
> Past signal performance does not guarantee future results.  
> Trade responsibly. Never risk more than you can afford to lose.

---

## 🗺️ Roadmap

- [ ] Economic Calendar integration (NFP/CPI no-trade zones)
- [ ] Price Alert system with Telegram notify
- [ ] Win/Loss trade tracker
- [ ] Backtesting engine
- [ ] Multi-asset support (EURUSD, BTCUSD)
- [ ] Mobile app (React Native)

---

## 📄 License

This project is licensed under the **MIT License** — free to use, modify, and distribute with attribution.

---

## 👤 Author

**foli-sketch**  
Built with 💛 for serious Gold traders.

---

*Aura Terminal Pro — See the market. Understand the signal.*
