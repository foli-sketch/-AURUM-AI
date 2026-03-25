from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import numpy as np
from ta.trend import (EMAIndicator, SMAIndicator, MACD,
    ADXIndicator, PSARIndicator, IchimokuIndicator, CCIIndicator)
from ta.momentum import (RSIIndicator, StochasticOscillator,
    StochRSIIndicator, WilliamsRIndicator, ROCIndicator)
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
TG_TOKEN = os.environ.get("TG_TOKEN", "7881020859:AAFC0tCl_KOo3T5BZoLjVMux2hxiRkh2Fsw")
TG_CHAT  = os.environ.get("TG_CHAT",  "7881020859")

recent_signals = []

TF_MAP = {
    "5m":  {"period": "5d",   "interval": "5m"},
    "15m": {"period": "10d",  "interval": "15m"},
    "30m": {"period": "20d",  "interval": "30m"},
    "1h":  {"period": "60d",  "interval": "1h"},
    "4h":  {"period": "120d", "interval": "1h"},
    "1d":  {"period": "2y",   "interval": "1d"},
}

# ─── SESSION ────────────────────────────────────────────────────────────────
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

# ─── CANDLESTICK PATTERNS ────────────────────────────────────────────────────
def detect_patterns(df):
    patterns = []
    if len(df) < 3:
        return patterns
    o = df['Open'].values
    h = df['High'].values
    l = df['Low'].values
    c = df['Close'].values
    i = len(c) - 1
    body  = abs(c[i] - o[i])
    full  = h[i] - l[i]
    upper = h[i] - max(c[i], o[i])
    lower = min(c[i], o[i]) - l[i]
    if full > 0 and body <= 0.1 * full:
        patterns.append({"name": "Doji", "type": "NEUTRAL"})
    if lower > 2 * body and upper < body and c[i] > o[i]:
        patterns.append({"name": "Hammer", "type": "BULLISH"})
    if upper > 2 * body and lower < body and c[i] < o[i]:
        patterns.append({"name": "Shooting Star", "type": "BEARISH"})
    if (c[i] > o[i] and c[i-1] < o[i-1] and c[i] > o[i-1] and o[i] < c[i-1]):
        patterns.append({"name": "Bullish Engulfing", "type": "BULLISH"})
    if (c[i] < o[i] and c[i-1] > o[i-1] and c[i] < o[i-1] and o[i] > c[i-1]):
        patterns.append({"name": "Bearish Engulfing", "type": "BEARISH"})
    if body > 0 and full > 0 and body > 0.95 * full and c[i] > o[i]:
        patterns.append({"name": "Bullish Marubozu", "type": "BULLISH"})
    if body > 0 and full > 0 and body > 0.95 * full and c[i] < o[i]:
        patterns.append({"name": "Bearish Marubozu", "type": "BEARISH"})
    if i >= 2:
        b2 = abs(c[i-2]-o[i-2])
        b1 = abs(c[i-1]-o[i-1])
        if (c[i-2]<o[i-2] and b1<0.3*b2 and c[i]>o[i] and c[i]>((c[i-2]+o[i-2])/2)):
            patterns.append({"name": "Morning Star", "type": "BULLISH"})
        if (c[i-2]>o[i-2] and b1<0.3*b2 and c[i]<o[i] and c[i]<((c[i-2]+o[i-2])/2)):
            patterns.append({"name": "Evening Star", "type": "BEARISH"})
    return patterns

# ─── DIVERGENCE ──────────────────────────────────────────────────────────────
def detect_divergences(df):
    result = {"rsi": "none", "macd": "none"}
    if len(df) < 20:
        return result
    close     = df['Close']
    rsi_vals  = RSIIndicator(close, 14).rsi().values[-20:]
    macd_hist = MACD(close, 26, 12, 9).macd_diff().values[-20:]
    price_arr = close.values[-20:]
    price_ll  = price_arr[-1] < price_arr[-10]
    price_hh  = price_arr[-1] > price_arr[-10]
    valid_rsi = not (np.isnan(rsi_vals[-1]) or np.isnan(rsi_vals[-10]))
    if valid_rsi:
        if price_ll and rsi_vals[-1] > rsi_vals[-10]:
            result["rsi"] = "bullish"
        elif price_hh and rsi_vals[-1] < rsi_vals[-10]:
            result["rsi"] = "bearish"
    valid_macd = not (np.isnan(macd_hist[-1]) or np.isnan(macd_hist[-10]))
    if valid_macd:
        if price_ll and macd_hist[-1] > macd_hist[-10]:
            result["macd"] = "bullish"
        elif price_hh and macd_hist[-1] < macd_hist[-10]:
            result["macd"] = "bearish"
    return result

# ─── SMC ─────────────────────────────────────────────────────────────────────
def detect_smc(df):
    result = {"bullish_obs":[], "bearish_obs":[], "fvgs":[], "equal_highs":[], "equal_lows":[]}
    if len(df) < 10:
        return result
    h = df['High'].values
    l = df['Low'].values
    o = df['Open'].values
    c = df['Close'].values
    for i in range(2, min(len(c)-1, 50)):
        body_curr = abs(c[i]-o[i])
        body_next = abs(c[i+1]-o[i+1]) if i+1 < len(c) else 0
        if c[i]<o[i] and c[i+1]>o[i+1] and body_next > 1.5*body_curr:
            result["bullish_obs"].append({"high": round(float(h[i]),2), "low": round(float(l[i]),2)})
        if c[i]>o[i] and c[i+1]<o[i+1] and body_next > 1.5*body_curr:
            result["bearish_obs"].append({"high": round(float(h[i]),2), "low": round(float(l[i]),2)})
    result["bullish_obs"] = result["bullish_obs"][-3:]
    result["bearish_obs"] = result["bearish_obs"][-3:]
    for i in range(1, min(len(c)-1, 50)):
        if i+1 < len(c):
            if l[i-1] > h[i+1]:
                result["fvgs"].append({"type":"bearish","top":round(float(l[i-1]),2),"bottom":round(float(h[i+1]),2)})
            if h[i-1] < l[i+1]:
                result["fvgs"].append({"type":"bullish","top":round(float(l[i+1]),2),"bottom":round(float(h[i-1]),2)})
    result["fvgs"] = result["fvgs"][-4:]
    tol = 0.001
    eq_h = []
    for i in range(len(h)-1):
        for j in range(i+1, min(i+10, len(h))):
            if h[i]>0 and abs(h[i]-h[j])/h[i] < tol:
                eq_h.append(round(float(h[i]),2)); break
    eq_l = []
    for i in range(len(l)-1):
        for j in range(i+1, min(i+10, len(l))):
            if l[i]>0 and abs(l[i]-l[j])/l[i] < tol:
                eq_l.append(round(float(l[i]),2)); break
    result["equal_highs"] = list(set(eq_h))[-3:]
    result["equal_lows"]  = list(set(eq_l))[-3:]
    return result

# ─── SUPPORT / RESISTANCE ─────────────────────────────────────────────────────
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
    support    = sorted(set(support[-10:]))[-5:]
    return support, resistance

# ─── MULTI-TIMEFRAME BIAS ─────────────────────────────────────────────────────
def get_mtf_bias():
    mtf_data = {}
    for tf in ["1h","4h","1d"]:
        try:
            cfg = TF_MAP[tf]
            d = yf.Ticker("GC=F").history(period=cfg["period"], interval=cfg["interval"])
            if d.empty or len(d) < 30:
                mtf_data[tf] = {"bias":"NEUTRAL","rsi":None,"macd_bull":None,"ema_bull":None}
                continue
            c   = d['Close']
            e8  = EMAIndicator(c,8).ema_indicator().iloc[-1]
            e21 = EMAIndicator(c,21).ema_indicator().iloc[-1]
            mk  = MACD(c,26,12,9)
            mv  = mk.macd().iloc[-1]
            ms  = mk.macd_signal().iloc[-1]
            rsi = RSIIndicator(c,14).rsi().iloc[-1]
            ema_bull  = bool(e8 > e21)
            macd_bull = bool(mv > ms)
            if ema_bull and macd_bull:
                bias = "BULLISH"
            elif not ema_bull and not macd_bull:
                bias = "BEARISH"
            else:
                bias = "NEUTRAL"
            mtf_data[tf] = {
                "bias": bias,
                "rsi":  round(float(rsi),1) if not np.isnan(rsi) else None,
                "macd_bull": macd_bull,
                "ema_bull":  ema_bull,
            }
        except Exception as ex:
            logger.warning(f"MTF {tf} error: {ex}")
            mtf_data[tf] = {"bias":"NEUTRAL","rsi":None,"macd_bull":None,"ema_bull":None}
    bull = sum(1 for v in mtf_data.values() if v["bias"]=="BULLISH")
    bear = sum(1 for v in mtf_data.values() if v["bias"]=="BEARISH")
    overall = "BULLISH" if bull>=2 else "BEARISH" if bear>=2 else "MIXED"
    return mtf_data, overall

# ─── GROQ AI ─────────────────────────────────────────────────────────────────
def call_groq(messages, max_tokens=512):
    try:
        r = http_requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_KEY}", "Content-Type": "application/json"},
            json={"model":"llama-3.3-70b-versatile","messages":messages,"max_tokens":max_tokens},
            timeout=20)
        return r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        logger.warning(f"Groq error: {e}")
        return None

def safe_float(val):
    if val is None: return None
    try:
        f = float(val)
        return None if (np.isnan(f) or np.isinf(f)) else round(f, 4)
    except:
        return None

def safe(v): return v if v is not None else 0

# ─── MAIN SIGNAL ENDPOINT ────────────────────────────────────────────────────
@app.route("/api/trading/signal")
def get_signal():
    try:
        tf = request.args.get("timeframe","1h")
        cfg = TF_MAP.get(tf, TF_MAP["1h"])
        ticker = yf.Ticker("GC=F")
        df = ticker.history(period=cfg["period"], interval=cfg["interval"])
        if df.empty:
            return jsonify({"error":"No data from yfinance"}), 500
        if tf == "4h":
            df = df.resample("4h").agg({"Open":"first","High":"max","Low":"min","Close":"last","Volume":"sum"}).dropna()
        df = df.dropna().reset_index()
        if len(df) < 30:
            return jsonify({"error":"Insufficient data"}), 500

        close  = df['Close']
        high   = df['High']
        low    = df['Low']
        volume = df['Volume']
        price  = round(float(close.iloc[-1]), 2)

        # ── INDICATORS ──────────────────────────────────────────────────────
        ema8   = EMAIndicator(close,8).ema_indicator()
        ema21  = EMAIndicator(close,21).ema_indicator()
        ema50  = EMAIndicator(close,50).ema_indicator()
        ema200 = EMAIndicator(close,200).ema_indicator()
        sma20  = SMAIndicator(close,20).sma_indicator()
        sma50  = SMAIndicator(close,50).sma_indicator()
        macd_obj  = MACD(close,26,12,9)
        macd_val  = macd_obj.macd()
        macd_sig  = macd_obj.macd_signal()
        macd_hist = macd_obj.macd_diff()
        adx_obj = ADXIndicator(high,low,close,14)
        adx_val = adx_obj.adx()
        adx_pos = adx_obj.adx_pos()
        adx_neg = adx_obj.adx_neg()
        psar    = PSARIndicator(high,low,close).psar()
        ich     = IchimokuIndicator(high,low,9,26,52)
        tenkan  = ich.ichimoku_conversion_line()
        kijun   = ich.ichimoku_base_line()
        senkou_a= ich.ichimoku_a()
        senkou_b= ich.ichimoku_b()
        rsi_val = RSIIndicator(close,14).rsi()
        stoch   = StochasticOscillator(high,low,close,14,3)
        stoch_k = stoch.stoch()
        stoch_d = stoch.stoch_signal()
        srsi    = StochRSIIndicator(close,14,3,3)
        srsi_k  = srsi.stochrsi_k()
        srsi_d  = srsi.stochrsi_d()
        cci_val = CCIIndicator(high,low,close,20).cci()
        willr   = WilliamsRIndicator(high,low,close,14).williams_r()
        roc_val = ROCIndicator(close,12).roc()
        atr_val = AverageTrueRange(high,low,close,14).average_true_range()
        bb      = BollingerBands(close,20,2)
        bb_up   = bb.bollinger_hband()
        bb_mid  = bb.bollinger_mavg()
        bb_low_b= bb.bollinger_lband()
        bb_wid  = bb.bollinger_wband()
        kc      = KeltnerChannel(high,low,close,20)
        kc_up   = kc.keltner_channel_hband()
        kc_low  = kc.keltner_channel_lband()
        dc_up   = DonchianChannel(high,low,close,20).donchian_channel_hband()
        dc_low  = DonchianChannel(high,low,close,20).donchian_channel_lband()
        obv_val = OnBalanceVolumeIndicator(close,volume).on_balance_volume()
        mfi_val = MFIIndicator(high,low,close,volume,14).money_flow_index()
        cmf_val = ChaikinMoneyFlowIndicator(high,low,close,volume,20).chaikin_money_flow()
        vwap_v  = VolumeWeightedAveragePrice(high,low,close,volume).volume_weighted_average_price()

        def last(s):
            v = s.iloc[-1]; return safe_float(v)

        L = {
            "ema8":last(ema8),"ema21":last(ema21),"ema50":last(ema50),"ema200":last(ema200),
            "sma20":last(sma20),"sma50":last(sma50),
            "macd":last(macd_val),"macd_signal":last(macd_sig),"macd_hist":last(macd_hist),
            "adx":last(adx_val),"adx_pos":last(adx_pos),"adx_neg":last(adx_neg),
            "psar":last(psar),"tenkan":last(tenkan),"kijun":last(kijun),
            "senkou_a":last(senkou_a),"senkou_b":last(senkou_b),
            "rsi":last(rsi_val),"stoch_k":last(stoch_k),"stoch_d":last(stoch_d),
            "srsi_k":last(srsi_k),"srsi_d":last(srsi_d),
            "cci":last(cci_val),"willr":last(willr),"roc":last(roc_val),
            "atr":last(atr_val),
            "bb_upper":last(bb_up),"bb_middle":last(bb_mid),"bb_lower":last(bb_low_b),"bb_width":last(bb_wid),
            "kc_upper":last(kc_up),"kc_lower":last(kc_low),
            "dc_upper":last(dc_up),"dc_lower":last(dc_low),
            "obv":last(obv_val),"mfi":last(mfi_val),"cmf":last(cmf_val),"vwap":last(vwap_v),
        }

        # ── DERIVED ─────────────────────────────────────────────────────────
        patterns   = detect_patterns(df)
        divergence = detect_divergences(df)
        smc        = detect_smc(df)
        support, resistance = get_sr_levels(df)
        mtf_data, mtf_bias  = get_mtf_bias()
        session, trade_ok   = get_session()

        e8=safe(L["ema8"]); e21=safe(L["ema21"]); e50=safe(L["ema50"])
        mv=safe(L["macd"]); ms=safe(L["macd_signal"]); mh=safe(L["macd_hist"])
        adx=safe(L["adx"]); ap=safe(L["adx_pos"]); an=safe(L["adx_neg"])
        rsi=safe(L["rsi"]); sk=safe(L["srsi_k"]); sd=safe(L["srsi_d"])
        cci=safe(L["cci"]); sa=safe(L["senkou_a"]); sb=safe(L["senkou_b"])
        ps=safe(L["psar"]); atr=safe(L["atr"]); cmf=safe(L["cmf"]); mfi=safe(L["mfi"])

        cloud_top = max(sa, sb)
        cloud_bot = min(sa, sb)

        near_bull_ob = any(abs(price - ob["high"])/price < 0.005 for ob in smc["bullish_obs"]) if smc["bullish_obs"] else False
        near_bear_ob = any(abs(price - ob["low"])/price  < 0.005 for ob in smc["bearish_obs"]) if smc["bearish_obs"] else False

        # ── BULL SCORING ────────────────────────────────────────────────────
        score = 0
        confirmations = []
        def bull(text, pts=1):
            confirmations.append({"text": text, "side": "bull"})
            return pts

        if e8>e21>e50:              score += bull("EMA Bullish Stack", 2)
        if mv>ms and mh>0:          score += bull("MACD Bullish Cross")
        if adx>25 and ap>an:        score += bull("Strong Bullish Trend (ADX)")
        if sa>0 and sb>0 and price>cloud_top: score += bull("Above Ichimoku Cloud")
        if ps>0 and price>ps:       score += bull("PSAR Bullish")
        if 40<rsi<70:               score += bull("RSI Healthy Zone")
        if rsi<35:                  score += bull("RSI Oversold Bounce")
        if sk>sd and sk<0.8:        score += bull("StochRSI Bullish Cross")
        if cci>0:                   score += bull("CCI Positive")
        if near_bull_ob:            score += bull("Near Bullish Order Block", 2)
        if divergence["rsi"]=="bullish":  score += bull("RSI Bullish Divergence", 2)
        if divergence["macd"]=="bullish": score += bull("MACD Bullish Divergence", 2)
        if cmf>0:                   score += bull("Positive Money Flow (CMF)")
        if mfi<40:                  score += bull("MFI Oversold")
        bull_pats = [p for p in patterns if p["type"]=="BULLISH"]
        if bull_pats:               score += bull(f"Pattern: {bull_pats[0]['name']}")
        if mtf_bias=="BULLISH":     score += bull("MTF Bullish Confluence", 2)
        if trade_ok:                score += bull(f"Active Session: {session}")

        # ── BEAR SCORING ────────────────────────────────────────────────────
        bear_score = 0
        bear_conf  = []
        def bear(text, pts=1):
            bear_conf.append({"text": text, "side": "bear"})
            return pts

        if e8<e21<e50:              bear_score += bear("EMA Bearish Stack", 2)
        if mv<ms and mh<0:          bear_score += bear("MACD Bearish Cross")
        if adx>25 and an>ap:        bear_score += bear("Strong Bearish Trend (ADX)")
        if sa>0 and sb>0 and price<cloud_bot: bear_score += bear("Below Ichimoku Cloud")
        if ps>0 and price<ps:       bear_score += bear("PSAR Bearish")
        if rsi>65:                  bear_score += bear("RSI Overbought")
        if near_bear_ob:            bear_score += bear("Near Bearish Order Block", 2)
        if divergence["rsi"]=="bearish":  bear_score += bear("RSI Bearish Divergence", 2)
        if divergence["macd"]=="bearish": bear_score += bear("MACD Bearish Divergence", 2)
        if cmf<0:                   bear_score += bear("Negative Money Flow (CMF)")
        bear_pats = [p for p in patterns if p["type"]=="BEARISH"]
        if bear_pats:               bear_score += bear(f"Pattern: {bear_pats[0]['name']}")
        if mtf_bias=="BEARISH":     bear_score += bear("MTF Bearish Confluence", 2)

        # ── SIGNAL DECISION ─────────────────────────────────────────────────
        confidence = min(round((max(score, bear_score) / 20) * 100), 99)

        if score>=7 and score>bear_score and trade_ok:
            signal = "BUY"
            sl  = round(price - atr*1.5, 2)
            tp1 = round(price + atr*2.0, 2)
            tp2 = round(price + atr*3.5, 2)
            tp3 = round(price + atr*5.0, 2)
            rr  = round((tp1-price)/(price-sl),2) if price!=sl else 0
            final_conf = confirmations
        elif bear_score>=7 and bear_score>score and trade_ok:
            signal = "SELL"
            sl  = round(price + atr*1.5, 2)
            tp1 = round(price - atr*2.0, 2)
            tp2 = round(price - atr*3.5, 2)
            tp3 = round(price - atr*5.0, 2)
            rr  = round((price-tp1)/(sl-price),2) if price!=sl else 0
            final_conf = bear_conf
        else:
            signal = "HOLD"
            sl = tp1 = tp2 = tp3 = rr = None
            final_conf = confirmations if score >= bear_score else bear_conf

        # ── STORE HISTORY ────────────────────────────────────────────────────
        global recent_signals
        recent_signals.insert(0, {
            "time":      datetime.now().strftime("%b %d, %H:%M:%S"),
            "timeframe": tf,
            "signal":    signal,
            "price":     price,
            "confidence":confidence,
            "pattern":   bull_pats[0]["name"] if bull_pats else (bear_pats[0]["name"] if bear_pats else "None")
        })
        recent_signals = recent_signals[:15]

        return jsonify({
            "price":          price,
            "signal":         signal,
            "confidence":     confidence,
            "score":          score,
            "bear_score":     bear_score,
            "confirmations":  final_conf,
            "session":        session,
            "trade_allowed":  trade_ok,
            "mtf_data":       mtf_data,
            "mtf_bias":       mtf_bias,
            "indicators":     L,
            "patterns":       patterns,
            "divergence":     divergence,
            "smc":            smc,
            "support":        support,
            "resistance":     resistance,
            "sl":   sl,  "tp1": tp1, "tp2": tp2, "tp3": tp3, "rr": rr,
            "timeframe":      tf,
            "recent_signals": recent_signals,
        })

    except Exception as e:
        logger.exception(e)
        return jsonify({"error": str(e)}), 500


# ─── NEWS ─────────────────────────────────────────────────────────────────────
@app.route("/api/trading/news")
def get_news():
    try:
        feeds = [
            ("https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC%3DF&region=US&lang=en-US", "Yahoo Finance"),
            ("https://www.kitco.com/rss/news.rss", "Kitco"),
            ("https://www.investing.com/rss/news_14.rss", "Investing.com"),
            ("https://www.fxstreet.com/rss/news", "FXStreet"),
        ]
        bull_kw = ["rise","up","bull","high","surge","rally","gain","strong","buy","support","above"]
        bear_kw = ["fall","down","bear","low","drop","crash","weak","decline","sell","below","pressure"]
        items = []
        for url, source in feeds:
            try:
                feed = feedparser.parse(url)
                for entry in feed.entries[:5]:
                    title   = entry.get("title","")
                    summary = entry.get("summary","")
                    text    = (title+" "+summary).lower()
                    if any(k in text for k in ["gold","xau","bullion","precious metal"]):
                        if any(k in text for k in bull_kw):
                            sentiment = "BULLISH"
                        elif any(k in text for k in bear_kw):
                            sentiment = "BEARISH"
                        else:
                            sentiment = "NEUTRAL"
                        items.append({
                            "title":     title,
                            "summary":   summary[:150],
                            "published": entry.get("published",""),
                            "url":       entry.get("link","#"),
                            "sentiment": sentiment,
                            "source":    source,
                        })
            except Exception as ex:
                logger.warning(f"Feed {source}: {ex}")
        return jsonify({"news": items[:12]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── HISTORY ──────────────────────────────────────────────────────────────────
@app.route("/api/trading/history")
def get_history():
    return jsonify({"history": recent_signals})


# ─── ANALYSIS (AI) ────────────────────────────────────────────────────────────
@app.route("/api/trading/analysis")
def get_analysis():
    try:
        tf  = request.args.get("timeframe","1h")
        cfg = TF_MAP.get(tf, TF_MAP["1h"])
        df  = yf.Ticker("GC=F").history(period=cfg["period"], interval=cfg["interval"])
        if df.empty:
            return jsonify({"analysis":"No data available"})
        close = df['Close']
        price = round(float(close.iloc[-1]),2)
        rsi   = round(float(RSIIndicator(close,14).rsi().iloc[-1]),2)
        prompt = f"""Analyze XAUUSD for {tf} timeframe.
Price: ${price} | RSI: {rsi}

Provide analysis in exactly this format:
1. SIGNAL REASON: (2 sentences why BUY/SELL/HOLD)
2. KEY INDICATORS: (3 bullet points with values)
3. CRITICAL LEVELS: (support and resistance to watch)
4. SMC CONTEXT: (order blocks or FVGs relevant)
5. RISK WARNING: (what could invalidate signal)
6. TRADE PLAN: (entry zone, SL, TP with brief reasoning)

Be concise and specific. Max 300 words total."""
        analysis = call_groq([
            {"role":"system","content":"Expert Gold trader analyst. Be specific and concise."},
            {"role":"user","content":prompt}
        ], max_tokens=512)
        return jsonify({"analysis": analysis or "AI analysis unavailable. Check API key."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── AI CHAT ──────────────────────────────────────────────────────────────────
@app.route("/api/trading/chat", methods=["POST"])
def chat():
    try:
        body     = request.json or {}
        user_msg = body.get("message","")
        history  = body.get("history",[])[-10:]
        market   = body.get("market_snapshot",{})

        system = f"""You are Jarvis, an expert Gold (XAUUSD) trader with 20 years experience.
Specialties: Smart Money Concepts, ICT methodology, multi-timeframe analysis.

LIVE MARKET DATA:
Price: ${market.get('price','N/A')} | Signal: {market.get('signal','N/A')} | Confidence: {market.get('confidence','N/A')}%
Session: {market.get('session','N/A')} | MTF Bias: {market.get('mtf_bias','N/A')}
RSI: {market.get('rsi','N/A')} | MACD: {market.get('macd','N/A')} | ADX: {market.get('adx','N/A')} | ATR: {market.get('atr','N/A')}
EMA8: {market.get('ema8','N/A')} | EMA21: {market.get('ema21','N/A')}
Patterns: {market.get('patterns','N/A')} | Divergence: {market.get('divergence','N/A')}
Support: {market.get('support','N/A')} | Resistance: {market.get('resistance','N/A')}
Confirmations: {market.get('confirmations','N/A')}

Answer concisely using bullet points. Reference specific values. Never guarantee profits."""

        messages = [{"role":"system","content":system}]
        for h in history:
            if h.get("role") in ("user","assistant"):
                messages.append({"role":h["role"],"content":h["content"]})
        messages.append({"role":"user","content":user_msg})

        response = call_groq(messages, max_tokens=400)
        return jsonify({"response": response or "I'm having trouble connecting right now. Please try again."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── TELEGRAM BROADCAST ───────────────────────────────────────────────────────
@app.route("/api/trading/telegram", methods=["POST"])
def send_telegram():
    try:
        body     = request.json or {}
        d        = body.get("data", {})
        signal   = d.get("signal","N/A")
        price    = d.get("price","N/A")
        conf     = d.get("confidence","N/A")
        sl       = d.get("sl","N/A")
        tp1      = d.get("tp1","N/A")
        tp2      = d.get("tp2","N/A")
        tp3      = d.get("tp3","N/A")
        rr       = d.get("rr","N/A")
        tf       = d.get("timeframe","N/A")
        sess     = d.get("session","N/A")
        mtf      = d.get("mtf_bias","N/A")
        score    = d.get("score",0)
        confs    = d.get("confirmations",[])
        patterns = d.get("patterns",[])
        div      = d.get("divergence",{})
        analysis = d.get("analysis","")

        emoji    = "🟢" if signal=="BUY" else "🔴" if signal=="SELL" else "🟡"
        pat_text = patterns[0]["name"] if patterns else "None"
        conf_text = "\n".join([f"  • {c['text']}" for c in confs[:5]])

        msg = f"""{emoji} <b>XAUUSD Signal — {tf}</b>
━━━━━━━━━━━━━━━━━━━━
📌 Signal: <b>{signal}</b>
📊 Confidence: <b>{conf}%</b> | Score: {score}/20
💰 Entry: <b>${price}</b>
🛑 SL: ${sl} | R/R: 1:{rr}
🎯 TP1: ${tp1}
🎯 TP2: ${tp2}
🎯 TP3: ${tp3}
━━━━━━━━━━━━━━━━━━━━
⏰ Session: {sess}
🌍 MTF Bias: {mtf}
━━━━━━━━━━━━━━━━━━━━
✅ <b>Top Confirmations:</b>
{conf_text}
━━━━━━━━━━━━━━━━━━━━
🕯️ Pattern: {pat_text}
📉 RSI Div: {div.get('rsi','none')} | MACD Div: {div.get('macd','none')}
━━━━━━━━━━━━━━━━━━━━
🤖 {analysis[:200] if analysis else 'N/A'}
━━━━━━━━━━━━━━━━━━━━
⚠️ Not financial advice. Trade responsibly."""

        url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
        r = http_requests.post(url, json={"chat_id":TG_CHAT,"text":msg,"parse_mode":"HTML"}, timeout=10)
        if r.status_code == 200:
            return jsonify({"success": True})
        else:
            return jsonify({"success": False, "error": r.text}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── PLOTLY CHART ────────────────────────────────────────────────────────────
@app.route("/api/trading/chart")
def get_chart():
    try:
        import plotly.graph_objects as go
        from plotly.subplots import make_subplots

        tf  = request.args.get("timeframe", "1h")
        cfg = TF_MAP.get(tf, TF_MAP["1h"])
        ticker = yf.Ticker("GC=F")
        df = ticker.history(period=cfg["period"], interval=cfg["interval"])
        if df.empty:
            return jsonify({"error": "No data"}), 500
        if tf == "4h":
            df = df.resample("4h").agg({"Open":"first","High":"max","Low":"min","Close":"last","Volume":"sum"}).dropna()
        df = df.dropna()
        if len(df) < 30:
            return jsonify({"error": "Insufficient data"}), 500

        # Limit to last 120 candles for performance
        df = df.iloc[-120:]

        close  = df['Close']
        high   = df['High']
        low    = df['Low']
        volume = df['Volume']

        # Indicators
        ema8_s   = EMAIndicator(close, 8).ema_indicator()
        ema21_s  = EMAIndicator(close, 21).ema_indicator()
        ema50_s  = EMAIndicator(close, 50).ema_indicator()
        ema200_s = EMAIndicator(close, 200).ema_indicator()
        bb       = BollingerBands(close, 20, 2)
        bb_up    = bb.bollinger_hband()
        bb_lo    = bb.bollinger_lband()
        rsi_s    = RSIIndicator(close, 14).rsi()
        macd_obj = MACD(close, 26, 12, 9)
        macd_s   = macd_obj.macd()
        macd_sig = macd_obj.macd_signal()
        macd_h   = macd_obj.macd_diff()
        atr_v    = AverageTrueRange(high, low, close, 14).average_true_range()

        price   = float(close.iloc[-1])
        atr     = float(atr_v.iloc[-1]) if not np.isnan(atr_v.iloc[-1]) else 10.0
        patterns   = detect_patterns(df.reset_index())
        smc        = detect_smc(df.reset_index())
        support, resistance = get_sr_levels(df.reset_index())
        _, mtf_bias = get_mtf_bias()
        session, trade_ok = get_session()

        # Re-run signal scoring (lightweight version)
        e8 = safe(safe_float(ema8_s.iloc[-1]))
        e21 = safe(safe_float(ema21_s.iloc[-1]))
        e50 = safe(safe_float(ema50_s.iloc[-1]))
        mv = safe(safe_float(macd_s.iloc[-1]))
        ms_v = safe(safe_float(macd_sig.iloc[-1]))
        rsi_v = safe(safe_float(rsi_s.iloc[-1]))
        sc = 0
        if e8>e21>e50: sc += 2
        if mv>ms_v: sc += 1
        if 40<rsi_v<70: sc += 1
        bear_sc = 0
        if e8<e21<e50: bear_sc += 2
        if mv<ms_v: bear_sc += 1
        if rsi_v>65: bear_sc += 1
        if sc>=7 and sc>bear_sc and trade_ok:
            sig = "BUY"
            sl  = round(price - atr*1.5, 2)
            tp1 = round(price + atr*2.0, 2)
            tp2 = round(price + atr*3.5, 2)
            tp3 = round(price + atr*5.0, 2)
        elif bear_sc>=7 and bear_sc>sc and trade_ok:
            sig = "SELL"
            sl  = round(price + atr*1.5, 2)
            tp1 = round(price - atr*2.0, 2)
            tp2 = round(price - atr*3.5, 2)
            tp3 = round(price - atr*5.0, 2)
        else:
            sig = "HOLD"; sl = tp1 = tp2 = tp3 = None

        # ── BUILD FIGURE ─────────────────────────────────────────────────────
        fig = make_subplots(
            rows=4, cols=1,
            shared_xaxes=True,
            row_heights=[0.55, 0.15, 0.15, 0.15],
            vertical_spacing=0.02,
            subplot_titles=("XAUUSD Price", "RSI (14)", "MACD", "Volume"),
        )

        # Candlestick
        fig.add_trace(go.Candlestick(
            x=df.index.astype(str).tolist(),
            open=df['Open'].tolist(), high=df['High'].tolist(),
            low=df['Low'].tolist(),  close=df['Close'].tolist(),
            name="XAUUSD",
            increasing_line_color="#26a69a",
            decreasing_line_color="#ef5350",
            increasing_fillcolor="#26a69a",
            decreasing_fillcolor="#ef5350",
        ), row=1, col=1)

        # EMAs
        fig.add_trace(go.Scatter(x=df.index.astype(str).tolist(), y=ema8_s.tolist(),
            name="EMA 8",   line=dict(color="#f5a623", width=1.5)), row=1, col=1)
        fig.add_trace(go.Scatter(x=df.index.astype(str).tolist(), y=ema21_s.tolist(),
            name="EMA 21",  line=dict(color="#2196F3", width=1.5)), row=1, col=1)
        fig.add_trace(go.Scatter(x=df.index.astype(str).tolist(), y=ema50_s.tolist(),
            name="EMA 50",  line=dict(color="#9C27B0", width=1)), row=1, col=1)
        fig.add_trace(go.Scatter(x=df.index.astype(str).tolist(), y=ema200_s.tolist(),
            name="EMA 200", line=dict(color="#FF5722", width=1)), row=1, col=1)

        # Bollinger Bands
        fig.add_trace(go.Scatter(x=df.index.astype(str).tolist(), y=bb_up.tolist(),
            name="BB Upper", line=dict(color="#555577", width=1, dash="dash")), row=1, col=1)
        fig.add_trace(go.Scatter(x=df.index.astype(str).tolist(), y=bb_lo.tolist(),
            name="BB Lower", line=dict(color="#555577", width=1, dash="dash"),
            fill="tonexty", fillcolor="rgba(100,100,130,0.08)"), row=1, col=1)

        # Support & Resistance
        for lvl in resistance[:5]:
            fig.add_hline(y=lvl, line_dash="dot",
                line_color="rgba(255,80,80,0.65)", line_width=1.5,
                annotation_text=f"R ${lvl:,.0f}",
                annotation_position="right",
                annotation_font_color="#ff5050",
                annotation_font_size=10, row=1, col=1)
        for lvl in support[:5]:
            fig.add_hline(y=lvl, line_dash="dot",
                line_color="rgba(80,255,150,0.65)", line_width=1.5,
                annotation_text=f"S ${lvl:,.0f}",
                annotation_position="right",
                annotation_font_color="#50ff96",
                annotation_font_size=10, row=1, col=1)

        # Order Blocks
        for ob in smc.get("bullish_obs", []):
            fig.add_hrect(y0=ob["low"], y1=ob["high"],
                fillcolor="rgba(0,255,100,0.08)",
                line=dict(color="rgba(0,255,100,0.35)", width=1),
                annotation_text="Bull OB",
                annotation_font_color="#00ff64",
                annotation_font_size=9, row=1, col=1)
        for ob in smc.get("bearish_obs", []):
            fig.add_hrect(y0=ob["low"], y1=ob["high"],
                fillcolor="rgba(255,50,50,0.08)",
                line=dict(color="rgba(255,50,50,0.35)", width=1),
                annotation_text="Bear OB",
                annotation_font_color="#ff3232",
                annotation_font_size=9, row=1, col=1)

        # FVG zones
        for fvg in smc.get("fvgs", []):
            fc = "rgba(0,200,255,0.07)" if fvg["type"]=="bullish" else "rgba(255,150,0,0.07)"
            lc = "rgba(0,200,255,0.3)"  if fvg["type"]=="bullish" else "rgba(255,150,0,0.3)"
            fig.add_hrect(y0=fvg["bottom"], y1=fvg["top"],
                fillcolor=fc, line=dict(color=lc, width=1),
                annotation_text="FVG",
                annotation_font_color=lc.replace("0.3)","0.8)"),
                annotation_font_size=9, row=1, col=1)

        # Pattern annotations
        x_last = df.index.astype(str).tolist()[-1]
        for pat in patterns:
            if pat["type"] == "BULLISH":
                fig.add_annotation(
                    x=x_last, y=float(df['Low'].iloc[-1]) - atr*0.3,
                    text=f"🟢 {pat['name']}", showarrow=True, arrowhead=2,
                    arrowcolor="#00ff64", font=dict(color="#00ff64", size=11),
                    row=1, col=1)
            elif pat["type"] == "BEARISH":
                fig.add_annotation(
                    x=x_last, y=float(df['High'].iloc[-1]) + atr*0.3,
                    text=f"🔴 {pat['name']}", showarrow=True, arrowhead=2,
                    arrowcolor="#ff3232", font=dict(color="#ff3232", size=11),
                    row=1, col=1)

        # Signal marker
        if sig == "BUY":
            fig.add_trace(go.Scatter(
                x=[x_last], y=[float(df['Low'].iloc[-1]) - atr],
                mode="markers+text",
                marker=dict(symbol="triangle-up", size=18, color="#00ff64",
                            line=dict(color="#00ff64", width=2)),
                text=["▲ BUY"], textposition="bottom center",
                textfont=dict(color="#00ff64", size=12),
                name="Signal"), row=1, col=1)
        elif sig == "SELL":
            fig.add_trace(go.Scatter(
                x=[x_last], y=[float(df['High'].iloc[-1]) + atr],
                mode="markers+text",
                marker=dict(symbol="triangle-down", size=18, color="#ff3232",
                            line=dict(color="#ff3232", width=2)),
                text=["▼ SELL"], textposition="top center",
                textfont=dict(color="#ff3232", size=12),
                name="Signal"), row=1, col=1)

        # Entry / SL / TP lines
        if sig != "HOLD" and sl is not None:
            fig.add_hline(y=price, line_color="#ffffff", line_width=1.5,
                annotation_text=f"ENTRY ${price:,.2f}",
                annotation_font_color="#ffffff", annotation_font_size=10, row=1, col=1)
            fig.add_hline(y=sl, line_color="#ff3232", line_width=1.5, line_dash="dash",
                annotation_text=f"SL ${sl:,.2f}",
                annotation_font_color="#ff3232", annotation_font_size=10, row=1, col=1)
            if tp1: fig.add_hline(y=tp1, line_color="#00e676", line_width=1, line_dash="dot",
                annotation_text=f"TP1 ${tp1:,.2f}",
                annotation_font_color="#00e676", annotation_font_size=10, row=1, col=1)
            if tp2: fig.add_hline(y=tp2, line_color="#00c853", line_width=1, line_dash="dot",
                annotation_text=f"TP2 ${tp2:,.2f}",
                annotation_font_color="#00c853", annotation_font_size=10, row=1, col=1)
            if tp3: fig.add_hline(y=tp3, line_color="#00a84a", line_width=1.5, line_dash="dot",
                annotation_text=f"TP3 ${tp3:,.2f}",
                annotation_font_color="#00a84a", annotation_font_size=10, row=1, col=1)

        # RSI subplot
        rsi_list = rsi_s.tolist()
        fig.add_trace(go.Scatter(x=df.index.astype(str).tolist(), y=rsi_list,
            name="RSI", line=dict(color="#f5a623", width=1.5)), row=2, col=1)
        fig.add_hline(y=70, line_color="#ff3232", line_dash="dash", line_width=1, row=2, col=1)
        fig.add_hline(y=30, line_color="#00e676", line_dash="dash", line_width=1, row=2, col=1)
        fig.add_hline(y=50, line_color="#444", line_dash="dot", line_width=0.5, row=2, col=1)

        # MACD subplot
        macd_list = macd_s.tolist()
        sig_list  = macd_sig.tolist()
        hist_list = macd_h.tolist()
        fig.add_trace(go.Scatter(x=df.index.astype(str).tolist(), y=macd_list,
            name="MACD", line=dict(color="#2196F3", width=1.5)), row=3, col=1)
        fig.add_trace(go.Scatter(x=df.index.astype(str).tolist(), y=sig_list,
            name="Signal", line=dict(color="#ff9800", width=1.5)), row=3, col=1)
        fig.add_trace(go.Bar(x=df.index.astype(str).tolist(), y=hist_list,
            name="Hist",
            marker_color=["#26a69a" if (v is not None and v >= 0) else "#ef5350" for v in hist_list]),
            row=3, col=1)

        # Volume subplot
        vol_colors = ["#26a69a" if float(c) >= float(o) else "#ef5350"
                      for c, o in zip(df['Close'].tolist(), df['Open'].tolist())]
        fig.add_trace(go.Bar(x=df.index.astype(str).tolist(), y=volume.tolist(),
            name="Volume", marker_color=vol_colors), row=4, col=1)

        # Layout
        fig.update_layout(
            paper_bgcolor="#0a0a0f",
            plot_bgcolor="#0d0d18",
            font=dict(color="#cccccc", size=11, family="Inter, system-ui"),
            xaxis_rangeslider_visible=False,
            legend=dict(bgcolor="rgba(18,18,26,0.9)", bordercolor="#2a2a3a",
                        borderwidth=1, orientation="h", x=0, y=1.02,
                        font=dict(size=10)),
            margin=dict(l=60, r=80, t=40, b=20),
            height=650,
            showlegend=True,
            hovermode="x unified",
        )
        fig.update_xaxes(
            gridcolor="#1a1a2a", showgrid=True,
            zeroline=False, showspikes=True,
            spikecolor="#444", spikethickness=1,
            spikemode="across",
        )
        fig.update_yaxes(
            gridcolor="#1a1a2a", showgrid=True,
            zeroline=False, showspikes=True,
            spikecolor="#444",
        )
        # Subplot title colors
        for ann in fig.layout.annotations:
            ann.font.color = "#f5a623"
            ann.font.size  = 11

        fig_dict = fig.to_dict()
        # Convert timestamps to strings for JSON serialization
        return jsonify(fig_dict)

    except Exception as e:
        logger.exception(e)
        return jsonify({"error": str(e)}), 500


# ─── HEALTH ───────────────────────────────────────────────────────────────────
@app.route("/api/healthz")
def health():
    return jsonify({"status":"ok"})

if __name__ == "__main__":
    port = int(os.environ.get("PYTHON_PORT", 8082))
    app.run(host="0.0.0.0", port=port, debug=False)
