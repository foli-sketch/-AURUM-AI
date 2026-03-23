from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import numpy as np
from ta.trend import (EMAIndicator, SMAIndicator, MACD,
    ADXIndicator, PSARIndicator, IchimokuIndicator, CCIIndicator)
from ta.momentum import (RSIIndicator, StochasticOscillator,
    StochRSIIndicator, WilliamsRIndicator,
    ROCIndicator)
from ta.volatility import (AverageTrueRange, BollingerBands,
    KeltnerChannel, DonchianChannel)
from ta.volume import (OnBalanceVolumeIndicator, MFIIndicator,
    ChaikinMoneyFlowIndicator, VolumeWeightedAveragePrice)
import requests as http_requests
import feedparser
import pytz
from datetime import datetime
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

GROQ_KEY = os.environ.get("GROQ_API_KEY", "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")

recent_signals = []

TF_MAP = {
    "5m":  {"period": "5d",   "interval": "5m"},
    "15m": {"period": "10d",  "interval": "15m"},
    "30m": {"period": "20d",  "interval": "30m"},
    "1h":  {"period": "60d",  "interval": "1h"},
    "4h":  {"period": "120d", "interval": "1h"},
    "1d":  {"period": "2y",   "interval": "1d"},
}

def get_session():
    utc = datetime.now(pytz.utc)
    h = utc.hour
    if 8 <= h < 16:
        if 13 <= h < 16:
            return "LONDON+NY OVERLAP", True
        return "LONDON", True
    elif 13 <= h < 21:
        return "NEW YORK", True
    return "OFF-HOURS", False

def detect_patterns(df):
    patterns = []
    if len(df) < 3:
        return patterns

    o = df['Open'].values
    h = df['High'].values
    l = df['Low'].values
    c = df['Close'].values
    n = len(c)
    i = n - 1

    body = abs(c[i] - o[i])
    full = h[i] - l[i]
    upper = h[i] - max(c[i], o[i])
    lower = min(c[i], o[i]) - l[i]

    if full > 0 and body <= 0.1 * full:
        patterns.append({"name": "Doji", "type": "NEUTRAL"})
    if lower > 2 * body and upper < body and c[i] > o[i]:
        patterns.append({"name": "Hammer", "type": "BULLISH"})
    if upper > 2 * body and lower < body and c[i] < o[i]:
        patterns.append({"name": "Shooting Star", "type": "BEARISH"})
    if (c[i] > o[i] and c[i-1] < o[i-1] and
        c[i] > o[i-1] and o[i] < c[i-1]):
        patterns.append({"name": "Bullish Engulfing", "type": "BULLISH"})
    if (c[i] < o[i] and c[i-1] > o[i-1] and
        c[i] < o[i-1] and o[i] > c[i-1]):
        patterns.append({"name": "Bearish Engulfing", "type": "BEARISH"})
    if body > 0 and full > 0 and body > 0.95 * full and c[i] > o[i]:
        patterns.append({"name": "Bullish Marubozu", "type": "BULLISH"})
    if body > 0 and full > 0 and body > 0.95 * full and c[i] < o[i]:
        patterns.append({"name": "Bearish Marubozu", "type": "BEARISH"})

    if i >= 2:
        b2 = abs(c[i-2]-o[i-2])
        b1 = abs(c[i-1]-o[i-1])
        if (c[i-2] < o[i-2] and b1 < 0.3*b2 and
            c[i] > o[i] and c[i] > ((c[i-2]+o[i-2])/2)):
            patterns.append({"name": "Morning Star", "type": "BULLISH"})
        if (c[i-2] > o[i-2] and b1 < 0.3*b2 and
            c[i] < o[i] and c[i] < ((c[i-2]+o[i-2])/2)):
            patterns.append({"name": "Evening Star", "type": "BEARISH"})

    return patterns

def detect_smc(df):
    result = {"bullish_obs": [], "bearish_obs": [],
              "fvgs": [], "equal_highs": [], "equal_lows": []}
    if len(df) < 10:
        return result

    h = df['High'].values
    l = df['Low'].values
    o = df['Open'].values
    c = df['Close'].values

    for i in range(2, min(len(c)-1, 50)):
        body_curr = abs(c[i]-o[i])
        body_next = abs(c[i+1]-o[i+1]) if i+1 < len(c) else 0
        if (c[i] < o[i] and c[i+1] > o[i+1] and
            body_next > 1.5*body_curr):
            result["bullish_obs"].append({
                "high": round(float(h[i]),2), "low": round(float(l[i]),2)})
        if (c[i] > o[i] and c[i+1] < o[i+1] and
            body_next > 1.5*body_curr):
            result["bearish_obs"].append({
                "high": round(float(h[i]),2), "low": round(float(l[i]),2)})

    result["bullish_obs"] = result["bullish_obs"][-3:]
    result["bearish_obs"] = result["bearish_obs"][-3:]

    for i in range(1, min(len(c)-1, 50)):
        if i+1 < len(c):
            if l[i-1] > h[i+1]:
                result["fvgs"].append({
                    "type": "bearish",
                    "top": round(float(l[i-1]),2),
                    "bottom": round(float(h[i+1]),2)})
            if h[i-1] < l[i+1]:
                result["fvgs"].append({
                    "type": "bullish",
                    "top": round(float(l[i+1]),2),
                    "bottom": round(float(h[i-1]),2)})

    result["fvgs"] = result["fvgs"][-4:]

    tol = 0.001
    eq_highs = []
    for i in range(len(h)-1):
        for j in range(i+1, min(i+10, len(h))):
            if h[i] > 0 and abs(h[i]-h[j])/h[i] < tol:
                eq_highs.append(round(float(h[i]),2))
                break
    eq_lows = []
    for i in range(len(l)-1):
        for j in range(i+1, min(i+10, len(l))):
            if l[i] > 0 and abs(l[i]-l[j])/l[i] < tol:
                eq_lows.append(round(float(l[i]),2))
                break

    result["equal_highs"] = list(set(eq_highs))[-3:]
    result["equal_lows"] = list(set(eq_lows))[-3:]
    return result

def get_sr_levels(df):
    resistance, support = [], []
    window = 15
    h = df['High'].values
    l = df['Low'].values
    for i in range(window, len(df)-window):
        if h[i] == max(h[i-window:i+window]):
            resistance.append(round(float(h[i]),2))
        if l[i] == min(l[i-window:i+window]):
            support.append(round(float(l[i]),2))
    resistance = sorted(set(resistance[-10:]), reverse=True)[:5]
    support = sorted(set(support[-10:]))[-5:]
    return support, resistance

def get_mtf_bias():
    mtf = {}
    for tf in ["1h","4h","1d"]:
        try:
            cfg = TF_MAP[tf]
            t = yf.Ticker("GC=F")
            d = t.history(period=cfg["period"], interval=cfg["interval"])
            if d.empty or len(d) < 30:
                mtf[tf] = "NEUTRAL"
                continue
            c = d['Close']
            e8  = EMAIndicator(c, 8).ema_indicator().iloc[-1]
            e21 = EMAIndicator(c, 21).ema_indicator().iloc[-1]
            mk  = MACD(c, 26, 12, 9)
            mv  = mk.macd().iloc[-1]
            ms  = mk.macd_signal().iloc[-1]
            if e8 > e21 and mv > ms:
                mtf[tf] = "BULLISH"
            elif e8 < e21 and mv < ms:
                mtf[tf] = "BEARISH"
            else:
                mtf[tf] = "NEUTRAL"
        except Exception as ex:
            logger.warning(f"MTF {tf} error: {ex}")
            mtf[tf] = "NEUTRAL"

    bull = sum(1 for v in mtf.values() if v == "BULLISH")
    bear = sum(1 for v in mtf.values() if v == "BEARISH")
    overall = "BULLISH" if bull >= 2 else "BEARISH" if bear >= 2 else "MIXED"
    return mtf, overall

def call_groq(prompt):
    try:
        r = http_requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_KEY}",
                     "Content-Type": "application/json"},
            json={"model": "llama-3.3-70b-versatile",
                  "messages": [{"role": "user", "content": prompt}],
                  "max_tokens": 256},
            timeout=10)
        return r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        logger.warning(f"Groq error: {e}")
        return None

def safe_float(val):
    if val is None:
        return None
    try:
        f = float(val)
        if np.isnan(f) or np.isinf(f):
            return None
        return round(f, 4)
    except:
        return None

@app.route("/api/trading/signal")
def get_signal():
    try:
        tf = request.args.get("timeframe", "1h")
        cfg = TF_MAP.get(tf, TF_MAP["1h"])

        ticker = yf.Ticker("GC=F")
        df = ticker.history(period=cfg["period"], interval=cfg["interval"])
        if df.empty:
            return jsonify({"error": "No data from yfinance"}), 500

        if tf == "4h":
            df = df.resample("4h").agg({
                "Open":"first","High":"max",
                "Low":"min","Close":"last","Volume":"sum"
            }).dropna()

        df = df.dropna().reset_index()
        if len(df) < 30:
            return jsonify({"error": "Insufficient data"}), 500

        close  = df['Close']
        high   = df['High']
        low    = df['Low']
        volume = df['Volume']
        price  = round(float(close.iloc[-1]), 2)

        ema8   = EMAIndicator(close, 8).ema_indicator()
        ema21  = EMAIndicator(close, 21).ema_indicator()
        ema50  = EMAIndicator(close, 50).ema_indicator()
        ema200 = EMAIndicator(close, 200).ema_indicator()
        sma20  = SMAIndicator(close, 20).sma_indicator()
        sma50  = SMAIndicator(close, 50).sma_indicator()
        macd_obj  = MACD(close, 26, 12, 9)
        macd_val  = macd_obj.macd()
        macd_sig  = macd_obj.macd_signal()
        macd_hist = macd_obj.macd_diff()
        adx_obj   = ADXIndicator(high, low, close, 14)
        adx_val   = adx_obj.adx()
        adx_pos   = adx_obj.adx_pos()
        adx_neg   = adx_obj.adx_neg()
        psar      = PSARIndicator(high, low, close).psar()
        ich       = IchimokuIndicator(high, low, 9, 26, 52)
        tenkan    = ich.ichimoku_conversion_line()
        kijun     = ich.ichimoku_base_line()
        senkou_a  = ich.ichimoku_a()
        senkou_b  = ich.ichimoku_b()
        rsi_val   = RSIIndicator(close, 14).rsi()
        stoch     = StochasticOscillator(high, low, close, 14, 3)
        stoch_k   = stoch.stoch()
        stoch_d   = stoch.stoch_signal()
        srsi      = StochRSIIndicator(close, 14, 3, 3)
        srsi_k    = srsi.stochrsi_k()
        srsi_d    = srsi.stochrsi_d()
        cci_val   = CCIIndicator(high, low, close, 20).cci()
        willr     = WilliamsRIndicator(high, low, close, 14).williams_r()
        roc_val   = ROCIndicator(close, 12).roc()
        atr_val   = AverageTrueRange(high, low, close, 14).average_true_range()
        bb        = BollingerBands(close, 20, 2)
        bb_up     = bb.bollinger_hband()
        bb_mid    = bb.bollinger_mavg()
        bb_low    = bb.bollinger_lband()
        bb_wid    = bb.bollinger_wband()
        kc        = KeltnerChannel(high, low, close, 20)
        kc_up     = kc.keltner_channel_hband()
        kc_low    = kc.keltner_channel_lband()
        dc_up     = DonchianChannel(high, low, close, 20).donchian_channel_hband()
        dc_low    = DonchianChannel(high, low, close, 20).donchian_channel_lband()
        obv_val   = OnBalanceVolumeIndicator(close, volume).on_balance_volume()
        mfi_val   = MFIIndicator(high, low, close, volume, 14).money_flow_index()
        cmf_val   = ChaikinMoneyFlowIndicator(high, low, close, volume, 20).chaikin_money_flow()
        vwap_val  = VolumeWeightedAveragePrice(high, low, close, volume).volume_weighted_average_price()

        def last(series):
            v = series.iloc[-1]
            return safe_float(v)

        L = {
            "ema8": last(ema8), "ema21": last(ema21),
            "ema50": last(ema50), "ema200": last(ema200),
            "sma20": last(sma20), "sma50": last(sma50),
            "macd": last(macd_val), "macd_signal": last(macd_sig),
            "macd_hist": last(macd_hist),
            "adx": last(adx_val), "adx_pos": last(adx_pos),
            "adx_neg": last(adx_neg),
            "psar": last(psar),
            "tenkan": last(tenkan), "kijun": last(kijun),
            "senkou_a": last(senkou_a), "senkou_b": last(senkou_b),
            "rsi": last(rsi_val),
            "stoch_k": last(stoch_k), "stoch_d": last(stoch_d),
            "srsi_k": last(srsi_k), "srsi_d": last(srsi_d),
            "cci": last(cci_val), "willr": last(willr),
            "roc": last(roc_val),
            "atr": last(atr_val),
            "bb_upper": last(bb_up), "bb_middle": last(bb_mid),
            "bb_lower": last(bb_low), "bb_width": last(bb_wid),
            "kc_upper": last(kc_up), "kc_lower": last(kc_low),
            "dc_upper": last(dc_up), "dc_lower": last(dc_low),
            "obv": last(obv_val), "mfi": last(mfi_val),
            "cmf": last(cmf_val), "vwap": last(vwap_val),
        }

        buy_signals, sell_signals = 0, 0
        indicators = []

        def ind_signal(name, value, sig_type, extra=None):
            indicators.append({"name": name, "value": value, "signal": sig_type, "extra": extra})
            if sig_type == "BUY":
                return 1, 0
            elif sig_type == "SELL":
                return 0, 1
            return 0, 0

        e8  = L["ema8"]  or 0
        e21 = L["ema21"] or 0
        e50 = L["ema50"] or 0
        e200= L["ema200"]or 0

        if e8 and e21:
            sig = "BUY" if e8 > e21 else "SELL"
            b, s = ind_signal("EMA 8/21", L["ema8"], sig, f"EMA21={e21:.2f}")
            buy_signals += b; sell_signals += s

        if e50 and e200:
            sig = "BUY" if e50 > e200 else "SELL"
            b, s = ind_signal("EMA 50/200 (Golden/Death)", L["ema50"], sig, f"EMA200={e200:.2f}")
            buy_signals += b; sell_signals += s

        if L["sma20"] and L["sma50"]:
            sig = "BUY" if L["sma20"] > L["sma50"] else "SELL"
            b, s = ind_signal("SMA 20/50", L["sma20"], sig)
            buy_signals += b; sell_signals += s

        if L["macd"] is not None and L["macd_signal"] is not None:
            sig = "BUY" if L["macd"] > L["macd_signal"] else "SELL"
            b, s = ind_signal("MACD", L["macd"], sig, f"Signal={L['macd_signal']}")
            buy_signals += b; sell_signals += s

        if L["macd_hist"] is not None:
            sig = "BUY" if L["macd_hist"] > 0 else "SELL"
            b, s = ind_signal("MACD Histogram", L["macd_hist"], sig)
            buy_signals += b; sell_signals += s

        if L["adx"] is not None:
            adx = L["adx"]
            adx_p = L["adx_pos"] or 0
            adx_n = L["adx_neg"] or 0
            if adx > 25:
                sig = "BUY" if adx_p > adx_n else "SELL"
            else:
                sig = "NEUTRAL"
            b, s = ind_signal("ADX", adx, sig, f"+DI={adx_p:.1f} -DI={adx_n:.1f}")
            buy_signals += b; sell_signals += s

        if L["psar"] is not None:
            sig = "BUY" if price > L["psar"] else "SELL"
            b, s = ind_signal("Parabolic SAR", L["psar"], sig)
            buy_signals += b; sell_signals += s

        if L["tenkan"] and L["kijun"]:
            sig = "BUY" if L["tenkan"] > L["kijun"] else "SELL"
            b, s = ind_signal("Ichimoku TK", L["tenkan"], sig, f"Kijun={L['kijun']:.2f}")
            buy_signals += b; sell_signals += s
        if L["senkou_a"] and L["senkou_b"]:
            cloud_top = max(L["senkou_a"], L["senkou_b"])
            cloud_bot = min(L["senkou_a"], L["senkou_b"])
            if price > cloud_top:
                sig = "BUY"
            elif price < cloud_bot:
                sig = "SELL"
            else:
                sig = "NEUTRAL"
            b, s = ind_signal("Ichimoku Cloud", price, sig, f"Top={cloud_top:.2f} Bot={cloud_bot:.2f}")
            buy_signals += b; sell_signals += s

        if L["rsi"] is not None:
            rsi = L["rsi"]
            if rsi < 30:
                sig = "BUY"
            elif rsi > 70:
                sig = "SELL"
            elif rsi < 45:
                sig = "BUY"
            elif rsi > 55:
                sig = "SELL"
            else:
                sig = "NEUTRAL"
            b, s = ind_signal("RSI (14)", rsi, sig)
            buy_signals += b; sell_signals += s

        if L["stoch_k"] and L["stoch_d"]:
            if L["stoch_k"] < 20 and L["stoch_k"] > L["stoch_d"]:
                sig = "BUY"
            elif L["stoch_k"] > 80 and L["stoch_k"] < L["stoch_d"]:
                sig = "SELL"
            elif L["stoch_k"] > L["stoch_d"]:
                sig = "BUY"
            else:
                sig = "SELL"
            b, s = ind_signal("Stochastic", L["stoch_k"], sig, f"%D={L['stoch_d']:.1f}")
            buy_signals += b; sell_signals += s

        if L["srsi_k"] and L["srsi_d"]:
            sig = "BUY" if L["srsi_k"] > L["srsi_d"] and L["srsi_k"] < 0.8 else \
                  "SELL" if L["srsi_k"] < L["srsi_d"] and L["srsi_k"] > 0.2 else "NEUTRAL"
            b, s = ind_signal("StochRSI", L["srsi_k"], sig)
            buy_signals += b; sell_signals += s

        if L["cci"] is not None:
            cci = L["cci"]
            if cci < -100:
                sig = "BUY"
            elif cci > 100:
                sig = "SELL"
            else:
                sig = "NEUTRAL"
            b, s = ind_signal("CCI (20)", cci, sig)
            buy_signals += b; sell_signals += s

        if L["willr"] is not None:
            wr = L["willr"]
            sig = "BUY" if wr < -80 else "SELL" if wr > -20 else "NEUTRAL"
            b, s = ind_signal("Williams %R", wr, sig)
            buy_signals += b; sell_signals += s

        if L["roc"] is not None:
            sig = "BUY" if L["roc"] > 0 else "SELL"
            b, s = ind_signal("ROC (12)", L["roc"], sig)
            buy_signals += b; sell_signals += s

        if L["bb_upper"] and L["bb_lower"] and L["bb_middle"]:
            if price < L["bb_lower"]:
                sig = "BUY"
            elif price > L["bb_upper"]:
                sig = "SELL"
            elif price < L["bb_middle"]:
                sig = "SELL"
            else:
                sig = "BUY"
            b, s = ind_signal("Bollinger Bands", L["bb_middle"], sig, f"U={L['bb_upper']:.2f} L={L['bb_lower']:.2f}")
            buy_signals += b; sell_signals += s

        if L["mfi"] is not None:
            mfi = L["mfi"]
            sig = "BUY" if mfi < 20 else "SELL" if mfi > 80 else "NEUTRAL"
            b, s = ind_signal("MFI (14)", mfi, sig)
            buy_signals += b; sell_signals += s

        if L["cmf"] is not None:
            sig = "BUY" if L["cmf"] > 0.1 else "SELL" if L["cmf"] < -0.1 else "NEUTRAL"
            b, s = ind_signal("CMF (20)", L["cmf"], sig)
            buy_signals += b; sell_signals += s

        if L["vwap"] is not None:
            sig = "BUY" if price > L["vwap"] else "SELL"
            b, s = ind_signal("VWAP", L["vwap"], sig)
            buy_signals += b; sell_signals += s

        total = buy_signals + sell_signals
        if total == 0:
            net = 0
            confidence = 50
        else:
            net = (buy_signals - sell_signals) / total
            confidence = int(abs(net) * 100)

        strength = min(100, int(abs(buy_signals - sell_signals) / max(1, total) * 100 * 1.2))

        if net > 0.6:
            signal = "STRONG BUY"
        elif net > 0.3:
            signal = "BUY"
        elif net > 0.05:
            signal = "WEAK BUY"
        elif net < -0.6:
            signal = "STRONG SELL"
        elif net < -0.3:
            signal = "SELL"
        elif net < -0.05:
            signal = "WEAK SELL"
        else:
            signal = "NEUTRAL"

        atr = L["atr"] or (price * 0.005)
        is_buy = "BUY" in signal
        is_sell = "SELL" in signal

        entry = price
        if is_buy:
            stop_loss = round(price - 2 * atr, 2)
            tp1 = round(price + atr, 2)
            tp2 = round(price + 2 * atr, 2)
            tp3 = round(price + 3 * atr, 2)
        elif is_sell:
            stop_loss = round(price + 2 * atr, 2)
            tp1 = round(price - atr, 2)
            tp2 = round(price - 2 * atr, 2)
            tp3 = round(price - 3 * atr, 2)
        else:
            stop_loss = tp1 = tp2 = tp3 = None

        risk = abs(entry - stop_loss) if stop_loss else None
        reward = abs(tp2 - entry) if tp2 else None
        rr = round(reward / risk, 2) if risk and reward and risk > 0 else None

        patterns = detect_patterns(df)
        smc = detect_smc(df)
        support, resistance = get_sr_levels(df)
        mtf, mtf_overall = get_mtf_bias()
        session_name, session_active = get_session()

        ai_summary = None
        try:
            prompt = (
                f"Gold (XAU/USD) at ${price:.2f} on {tf} timeframe. "
                f"Signal: {signal} ({confidence}% confidence). "
                f"RSI: {L['rsi']:.1f if L['rsi'] else 'N/A'}, "
                f"MACD: {'bullish' if (L['macd'] or 0) > (L['macd_signal'] or 0) else 'bearish'}, "
                f"ADX: {L['adx']:.1f if L['adx'] else 'N/A'}, "
                f"Session: {session_name}. "
                f"Multi-TF Bias: {mtf_overall}. "
                f"Patterns: {[p['name'] for p in patterns]}. "
                f"In 2-3 sentences, provide a concise professional gold trading analysis."
            )
            ai_summary = call_groq(prompt)
        except Exception:
            pass

        signal_record = {
            "timestamp": datetime.now().isoformat(),
            "signal": signal,
            "price": price,
            "confidence": confidence,
            "timeframe": tf
        }
        recent_signals.insert(0, signal_record)
        if len(recent_signals) > 20:
            recent_signals.pop()

        return jsonify({
            "timestamp": datetime.now().isoformat(),
            "price": price,
            "timeframe": tf,
            "signal": signal,
            "confidence": confidence,
            "strength": strength,
            "entry": round(entry, 2),
            "stop_loss": stop_loss,
            "take_profit_1": tp1,
            "take_profit_2": tp2,
            "take_profit_3": tp3,
            "risk_reward": rr,
            "indicators": indicators,
            "patterns": patterns,
            "smc": smc,
            "mtf_bias": {"timeframes": mtf, "overall": mtf_overall},
            "session": {"name": session_name, "active": session_active},
            "support_levels": support,
            "resistance_levels": resistance,
            "ai_summary": ai_summary,
            "buy_score": buy_signals,
            "sell_score": sell_signals,
            "raw_indicators": L,
        })

    except Exception as e:
        logger.error(f"Signal error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route("/api/trading/news")
def get_news():
    news = []
    feeds = [
        ("https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC%3DF&region=US&lang=en-US", "Yahoo Finance"),
        ("https://www.kitco.com/rss/news.rss", "Kitco"),
        ("https://www.investing.com/rss/news_14.rss", "Investing.com"),
    ]
    for url, source in feeds:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:5]:
                news.append({
                    "title": entry.get("title", ""),
                    "link": entry.get("link", ""),
                    "summary": entry.get("summary", "")[:200],
                    "published": entry.get("published", ""),
                    "source": source
                })
        except Exception as ex:
            logger.warning(f"News feed error {source}: {ex}")
    return jsonify({"news": news[:15]})

@app.route("/api/trading/history")
def get_history():
    return jsonify({"history": recent_signals[:20]})

@app.route("/api/healthz")
def health():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    port = int(os.environ.get("PYTHON_PORT", 8082))
    app.run(host="0.0.0.0", port=port, debug=False)
