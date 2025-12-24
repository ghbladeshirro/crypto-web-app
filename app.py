from flask import Flask, render_template, jsonify, request
import requests
import json
from datetime import datetime
import threading
from functools import lru_cache
import time

app = Flask(__name__)

CONFIG = {
    'primary_currency': 'usd',
    'tracking_coin': 'bitcoin',
    'api_provider': 'coingecko',
    'refresh_interval': 30
}


DATA_CACHE = {
    'prices': {},
    'cache_time': {},
    'coin_list': []
}

COINGECKO_API = "https://api.coingecko.com/api/v3"

def get_cached_data(key, ttl=30):
    now = time.time()
    if key in DATA_CACHE['cache_time']:
        if now - DATA_CACHE['cache_time'][key] < ttl:
            return DATA_CACHE['prices'].get(key, {})
    return None

def set_cached_data(key, data):
    DATA_CACHE['prices'][key] = data
    DATA_CACHE['cache_time'][key] = time.time()

@lru_cache(maxsize=100)
def fetch_coin_list():
    try:
        url = f"{COINGECKO_API}/coins/list"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            return response.json()
    except:
        pass
    return []

def get_coin_data(coin_ids, vs_currency='usd'):
    coin_ids = [coin_ids] if isinstance(coin_ids, str) else coin_ids
    cache_key = f"{','.join(coin_ids)}_{vs_currency}"
    
    
    cached = get_cached_data(cache_key)
    if cached:
        return cached
    
    try:
        url = f"{COINGECKO_API}/simple/price"
        params = {
            'ids': ','.join(coin_ids),
            'vs_currencies': vs_currency,
            'include_24hr_change': 'true',
            'include_market_cap': 'true',
            'include_24hr_vol': 'true'
        }
        
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            set_cached_data(cache_key, data)
            return data
    except Exception as e:
        print(f"API Error: {e}")
    
    return {}

def get_conversion_rate(from_currency, to_currency, amount=1):
    try:
        
        if from_currency != 'usd' and to_currency != 'usd':
            
            data = get_coin_data([from_currency, to_currency], 'usd')
            if from_currency in data and to_currency in data:
                from_price = data[from_currency]['usd']
                to_price = data[to_currency]['usd']
                return (amount * from_price) / to_price
        
        elif from_currency != 'usd':
            data = get_coin_data([from_currency], to_currency)
            if from_currency in data and to_currency in data[from_currency]:
                rate = data[from_currency][to_currency]
                return amount * rate
        
        elif to_currency != 'usd':
            data = get_coin_data([to_currency], from_currency)
            if to_currency in data and from_currency in data[to_currency]:
                
                rate = data[to_currency][from_currency]
                return amount / rate
                
        else:
            
            rates = {
                'usd': {'eur': 0.92, 'rub': 92.5, 'cny': 7.2, 'jpy': 148, 'gbp': 0.79},
                'eur': {'usd': 1.09, 'rub': 100.5, 'cny': 7.8, 'jpy': 161, 'gbp': 0.86},
                'rub': {'usd': 0.011, 'eur': 0.01, 'cny': 0.078, 'jpy': 1.6, 'gbp': 0.0085},
                'cny': {'usd': 0.14, 'eur': 0.13, 'rub': 12.8, 'jpy': 20.6, 'gbp': 0.11},
                'jpy': {'usd': 0.0068, 'eur': 0.0062, 'rub': 0.63, 'cny': 0.049, 'gbp': 0.0053},
                'gbp': {'usd': 1.27, 'eur': 1.16, 'rub': 117.6, 'cny': 9.1, 'jpy': 188}
            }
            
            if from_currency in rates and to_currency in rates[from_currency]:
                return amount * rates[from_currency][to_currency]
            elif from_currency == to_currency:
                return amount
    
    except Exception as e:
        print(f"Conversion error: {e}")
    
    return None

@app.route('/')
def index():
    return render_template('index.html', 
                         primary_currency=CONFIG['primary_currency'].upper(),
                         tracking_coin=CONFIG['tracking_coin'])

@app.route('/api/prices')
def api_prices():
    vs_currency = request.args.get('vs_currency', CONFIG['primary_currency'])
    
    
    coins = ['bitcoin', 'ethereum', 'tether', CONFIG['tracking_coin']]
    data = get_coin_data(coins, vs_currency)
    
    
    result = {}
    for coin in coins:
        if coin in data:
            coin_data = data[coin]
            result[coin] = {
                'price': coin_data.get(vs_currency, 0),
                'change': coin_data.get(f'{vs_currency}_24h_change', 0),
                'market_cap': coin_data.get(f'{vs_currency}_market_cap', 0),
                'volume': coin_data.get(f'{vs_currency}_24h_vol', 0)
            }
    
    return jsonify({
        'success': True,
        'data': result,
        'timestamp': datetime.now().isoformat(),
        'vs_currency': vs_currency
    })

@app.route('/api/convert', methods=['POST'])
def api_convert():
    try:
        data = request.json
        from_curr = data.get('from', 'bitcoin')
        to_curr = data.get('to', 'usd')
        amount = float(data.get('amount', 1))
        
        result = get_conversion_rate(from_curr, to_curr, amount)
        
        if result is not None:
            return jsonify({
                'success': True,
                'from': from_curr,
                'to': to_curr,
                'amount': amount,
                'result': result,
                'rate': result / amount if amount > 0 else 0
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Conversion failed - check currency codes'
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

@app.route('/api/currencies')
def api_currencies():
    currencies = [
        {'code': 'usd', 'name': 'US Dollar', 'symbol': '$', 'type': 'fiat'},
        {'code': 'eur', 'name': 'Euro', 'symbol': '€', 'type': 'fiat'},
        {'code': 'rub', 'name': 'Russian Ruble', 'symbol': '₽', 'type': 'fiat'},
        {'code': 'cny', 'name': 'Chinese Yuan', 'symbol': '¥', 'type': 'fiat'},
        {'code': 'jpy', 'name': 'Japanese Yen', 'symbol': '¥', 'type': 'fiat'},
        {'code': 'gbp', 'name': 'British Pound', 'symbol': '£', 'type': 'fiat'},
        {'code': 'krw', 'name': 'South Korean Won', 'symbol': '₩', 'type': 'fiat'},
        {'code': 'inr', 'name': 'Indian Rupee', 'symbol': '₹', 'type': 'fiat'},
        {'code': 'brl', 'name': 'Brazilian Real', 'symbol': 'R$', 'type': 'fiat'},
        {'code': 'aud', 'name': 'Australian Dollar', 'symbol': 'A$', 'type': 'fiat'},
    ]
    
    return jsonify({
        'success': True,
        'currencies': currencies
    })

@app.route('/api/search_coins')
def api_search_coins():
    query = request.args.get('q', '').lower()
    limit = int(request.args.get('limit', 10))
    
    coins = fetch_coin_list()
    if query:
        results = [coin for coin in coins if query in coin['name'].lower() or query in coin['symbol'].lower()]
        results = results[:limit]
    else:
        
        popular_ids = ['bitcoin', 'ethereum', 'tether', 'binancecoin', 'ripple', 
                      'cardano', 'solana', 'dogecoin', 'polkadot', 'litecoin']
        results = [coin for coin in coins if coin['id'] in popular_ids]
    
    return jsonify({
        'success': True,
        'results': results[:limit]
    })

@app.route('/api/update_config', methods=['POST'])
def api_update_config():
    try:
        data = request.json
        if 'primary_currency' in data:
            CONFIG['primary_currency'] = data['primary_currency'].lower()
        if 'tracking_coin' in data:
            CONFIG['tracking_coin'] = data['tracking_coin'].lower()
        
        
        DATA_CACHE['prices'].clear()
        DATA_CACHE['cache_time'].clear()
        
        return jsonify({
            'success': True,
            'config': CONFIG
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

@app.route('/api/get_config')
def api_get_config():
    return jsonify({
        'success': True,
        'config': CONFIG
    })

if __name__ == '__main__':
    fetch_coin_list()
    app.run(debug=True, host='0.0.0.0', port=5000)