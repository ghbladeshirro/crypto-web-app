
let currentTab = 'home';
let refreshInterval = 30000;
let countdownTimer = null;
let countdownValue = 30;
let conversionHistory = [];
let currencyList = [];
let cryptoList = [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', icon: 'fab fa-btc' },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', icon: 'fab fa-ethereum' },
    { id: 'tether', name: 'Tether', symbol: 'USDT', icon: 'fas fa-dollar-sign' },
    { id: 'binancecoin', name: 'BNB', symbol: 'BNB', icon: 'fas fa-coins' },
    { id: 'solana', name: 'Solana', symbol: 'SOL', icon: 'fas fa-bolt' },
    { id: 'cardano', name: 'Cardano', symbol: 'ADA', icon: 'fas fa-chart-line' },
    { id: 'ripple', name: 'XRP', symbol: 'XRP', icon: 'fas fa-exchange-alt' },
    { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', icon: 'fas fa-dog' },
    { id: 'polkadot', name: 'Polkadot', symbol: 'DOT', icon: 'fas fa-circle' },
    { id: 'litecoin', name: 'Litecoin', symbol: 'LTC', icon: 'fab fa-ltc' }
];


const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const refreshBtn = document.getElementById('refreshBtn');
const countdownEl = document.getElementById('countdown');
const primaryCurrencySelect = document.getElementById('primaryCurrency');
const settingsCurrencySelect = document.getElementById('settingsCurrency');


document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
    loadData();
    startAutoRefresh();
    loadSavedTheme();
});


function initializeApp() {

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });


    refreshBtn.addEventListener('click', function () {
        this.classList.add('refreshing');
        loadData();
        setTimeout(() => this.classList.remove('refreshing'), 1000);
    });


    primaryCurrencySelect.addEventListener('change', function () {
        loadData();
        updateConversionRate();
    });


    setupConverter();


    setupSettings();


    loadCurrencies().then(() => {
        populateCurrencyDropdowns();
    });


    setInterval(updateClock, 1000);
}


async function loadData() {
    try {
        showLoading(true);

        const vsCurrency = primaryCurrencySelect.value;
        const response = await fetch(`/api/prices?vs_currency=${vsCurrency}`);
        const data = await response.json();

        if (data.success) {
            updatePrices(data.data);
            updateLastUpdate(data.timestamp);
            showNotification('Prices updated!', 'success');
        } else {
            throw new Error('Failed to load data');
        }
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification('Failed to load data', 'error');
    } finally {
        showLoading(false);
        resetCountdown();
    }
}


function updatePrices(data) {

    if (data.bitcoin) {
        const btc = data.bitcoin;
        document.getElementById('btc-price').textContent = formatPrice(btc.price, primaryCurrencySelect.value);
        updatePriceChange('btc-change', btc.change);
    }


    if (data.tether) {
        const usdt = data.tether;
        document.getElementById('usdt-price').textContent = formatPrice(usdt.price, primaryCurrencySelect.value);
        updatePriceChange('usdt-change', usdt.change);
    }


    const trackingCoin = document.getElementById('track-coin-name').textContent.toLowerCase();
    if (data[trackingCoin]) {
        const track = data[trackingCoin];
        document.getElementById('track-price').textContent = formatPrice(track.price, primaryCurrencySelect.value);
        updatePriceChange('track-change', track.change);
    }
}


function formatPrice(price, currency) {
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: price < 1 ? 6 : 2,
        maximumFractionDigits: price < 1 ? 6 : 2
    });

    return formatter.format(price);
}


function updatePriceChange(elementId, change) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.className = 'price-change ' + (change >= 0 ? 'positive' : 'negative');
    element.innerHTML = `<i class="fas fa-arrow-${change >= 0 ? 'up' : 'down'}"></i> 
                         <span>${change >= 0 ? '+' : ''}${change.toFixed(2)}%</span>`;
}


function updateLastUpdate(timestamp) {
    const time = new Date(timestamp).toLocaleTimeString();
    document.getElementById('lastUpdate').textContent = time;
    document.getElementById('apiLastUpdate').textContent = time;
}


function switchTab(tabId) {

    tabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        }
    });


    tabPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === `${tabId}-tab`) {
            pane.classList.add('active');
        }
    });

    currentTab = tabId;


    if (tabId === 'converter') {
        updateConversionRate();
    }
}


function setupConverter() {
    const fromAmount = document.getElementById('fromAmount');
    const toAmount = document.getElementById('toAmount');
    const convertBtn = document.getElementById('convertBtn');
    const swapBtn = document.getElementById('swapBtn');
    const fromCurrencyBtn = document.getElementById('fromCurrencyBtn');
    const toCurrencyBtn = document.getElementById('toCurrencyBtn');
    const quickBtns = document.querySelectorAll('.quick-btn');


    convertBtn.addEventListener('click', async function () {
        const amount = parseFloat(fromAmount.value);
        const fromCurrency = fromCurrencyBtn.getAttribute('data-currency') || 'bitcoin';
        const toCurrency = toCurrencyBtn.getAttribute('data-currency') || 'usd';

        if (!amount || amount <= 0 || isNaN(amount)) {
            showNotification('Please enter a valid amount', 'error');
            return;
        }

        try {
            showLoading(true);

            const response = await fetch('/api/convert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: fromCurrency,
                    to: toCurrency,
                    amount: amount
                })
            });

            const data = await response.json();

            if (data.success) {

                const isCrypto = cryptoList.some(c => c.id === toCurrency);
                const formattedResult = isCrypto ?
                    data.result.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 8
                    }) :
                    data.result.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    });

                toAmount.value = formattedResult;


                addToHistory({
                    from: fromCurrency.toUpperCase(),
                    to: toCurrency.toUpperCase(),
                    amount: amount,
                    result: data.result,
                    rate: data.rate,
                    timestamp: new Date().toISOString()
                });

                showNotification('Conversion successful!', 'success');
            } else {
                throw new Error(data.error || 'Conversion failed');
            }
        } catch (error) {
            console.error('Conversion error:', error);
            showNotification(error.message || 'Conversion failed. Please try again.', 'error');
        } finally {
            showLoading(false);
        }
    });


    swapBtn.addEventListener('click', function () {
        const fromCurrency = fromCurrencyBtn.getAttribute('data-currency');
        const toCurrency = toCurrencyBtn.getAttribute('data-currency');
        const fromAmountValue = fromAmount.value;
        const toAmountValue = toAmount.value;


        const fromCurrencyText = fromCurrencyBtn.innerHTML;
        const toCurrencyText = toCurrencyBtn.innerHTML;

        fromCurrencyBtn.innerHTML = toCurrencyText;
        fromCurrencyBtn.setAttribute('data-currency', toCurrency);
        toCurrencyBtn.innerHTML = fromCurrencyText;
        toCurrencyBtn.setAttribute('data-currency', fromCurrency);


        if (toAmountValue && toAmountValue !== '0.00' && !isNaN(parseFloat(toAmountValue))) {
            fromAmount.value = parseFloat(toAmountValue);
            toAmount.value = '';
        }


        updateConversionRate();
    });


    quickBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const amount = this.getAttribute('data-amount');
            fromAmount.value = amount;
            updateConversionRate();
        });
    });


    fromAmount.addEventListener('input', function () {
        if (this.value && !isNaN(parseFloat(this.value))) {
            updateConversionRate();
        }
    });
}


async function updateConversionRate() {
    const fromAmount = document.getElementById('fromAmount');
    const fromCurrency = document.getElementById('fromCurrencyBtn').getAttribute('data-currency') || 'bitcoin';
    const toCurrency = document.getElementById('toCurrencyBtn').getAttribute('data-currency') || 'usd';
    const amount = parseFloat(fromAmount.value) || 1;

    try {
        const response = await fetch('/api/convert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: fromCurrency,
                to: toCurrency,
                amount: 1
            })
        });

        const data = await response.json();

        if (data.success) {
            const rateElement = document.getElementById('conversionRateText');
            const formattedRate = data.rate.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6
            });

            const fromSymbol = cryptoList.find(c => c.id === fromCurrency)?.symbol || fromCurrency.toUpperCase();
            const toSymbol = cryptoList.find(c => c.id === toCurrency)?.symbol || toCurrency.toUpperCase();

            rateElement.textContent = `1 ${fromSymbol} = ${formattedRate} ${toSymbol}`;
        }
    } catch (error) {
        console.error('Error loading conversion rate:', error);
    }
}


function addToHistory(conversion) {
    conversionHistory.unshift(conversion);
    if (conversionHistory.length > 5) {
        conversionHistory = conversionHistory.slice(0, 5);
    }
    updateConversionHistory();
}


function updateConversionHistory() {
    const historyElement = document.getElementById('conversionHistory');
    historyElement.innerHTML = '';

    if (conversionHistory.length === 0) {
        historyElement.innerHTML = '<div class="no-history">No conversions yet</div>';
        return;
    }

    conversionHistory.forEach(conversion => {
        const time = new Date(conversion.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <div class="history-content">
                <div class="history-pair">
                    <span class="history-amount">${conversion.amount}</span>
                    <span class="history-from">${conversion.from}</span>
                    <i class="fas fa-arrow-right"></i>
                    <span class="history-result">${conversion.result.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 8
        })}</span>
                    <span class="history-to">${conversion.to}</span>
                </div>
                <div class="history-rate">
                    Rate: 1 ${conversion.from} = ${conversion.rate.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6
        })} ${conversion.to}
                </div>
            </div>
            <div class="history-time">${time}</div>
        `;
        historyElement.appendChild(item);
    });
}


function setupSettings() {
    const coinSearch = document.getElementById('coinSearch');
    const searchBtn = document.getElementById('searchBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const refreshIntervalSelect = document.getElementById('refreshInterval');
    const themeBtns = document.querySelectorAll('.theme-btn');


    searchBtn.addEventListener('click', searchCoins);
    coinSearch.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            searchCoins();
        }
    });


    saveSettingsBtn.addEventListener('click', saveSettings);


    refreshIntervalSelect.addEventListener('change', function () {
        refreshInterval = parseInt(this.value) * 1000;
        if (refreshInterval === 0) {
            stopAutoRefresh();
        } else {
            startAutoRefresh();
        }
        showNotification(`Auto-refresh set to ${this.value === '0' ? 'off' : this.value + ' seconds'}`, 'success');
    });


    themeBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const theme = this.getAttribute('data-theme');
            switchTheme(theme);
            themeBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            showNotification(`Theme changed to ${theme} mode`, 'success');
        });
    });
}


async function loadCurrencies() {
    try {
        const response = await fetch('/api/currencies');
        const data = await response.json();

        if (data.success) {
            currencyList = data.currencies;
        }
    } catch (error) {
        console.error('Error loading currencies:', error);
    }
}


function populateCurrencyDropdowns() {
    const fromDropdown = document.getElementById('fromDropdown');
    const toDropdown = document.getElementById('toDropdown');
    const fromCurrencyBtn = document.getElementById('fromCurrencyBtn');
    const toCurrencyBtn = document.getElementById('toCurrencyBtn');


    fromDropdown.innerHTML = '';
    toDropdown.innerHTML = '';


    cryptoList.forEach(coin => {
        addCurrencyOption(fromDropdown, coin);
        addCurrencyOption(toDropdown, coin);
    });


    addSeparator(fromDropdown);
    addSeparator(toDropdown);


    currencyList.forEach(currency => {
        const coin = {
            id: currency.code,
            name: currency.name,
            symbol: currency.code.toUpperCase(),
            icon: 'fas fa-money-bill-wave'
        };
        addCurrencyOption(fromDropdown, coin);
        addCurrencyOption(toDropdown, coin);
    });


    setDefaultCurrency(fromCurrencyBtn, 'bitcoin');
    setDefaultCurrency(toCurrencyBtn, 'usd');


    setupDropdownToggle('fromCurrencyBtn', 'fromDropdown');
    setupDropdownToggle('toCurrencyBtn', 'toDropdown');
}


function addCurrencyOption(dropdown, coin) {
    const option = document.createElement('div');
    option.className = 'currency-option';
    option.setAttribute('data-currency', coin.id);
    option.innerHTML = `
        <i class="${coin.icon}"></i>
        ${coin.name} (${coin.symbol})
    `;

    option.addEventListener('click', function () {
        const button = dropdown.closest('.currency-select').querySelector('.currency-btn');
        button.innerHTML = `<i class="${coin.icon}"></i> <span>${coin.symbol}</span> <i class="fas fa-chevron-down"></i>`;
        button.setAttribute('data-currency', coin.id);
        dropdown.classList.remove('show');
        updateConversionRate();
    });

    dropdown.appendChild(option);
}


function addSeparator(dropdown) {
    const separator = document.createElement('div');
    separator.className = 'currency-option';
    separator.style.fontSize = '0.8rem';
    separator.style.color = 'var(--text-tertiary)';
    separator.style.pointerEvents = 'none';
    separator.style.borderBottom = '2px solid var(--border-color)';
    separator.textContent = '────────────';
    dropdown.appendChild(separator);
}


function setDefaultCurrency(button, currencyId) {
    let coin;

    if (cryptoList.some(c => c.id === currencyId)) {
        coin = cryptoList.find(c => c.id === currencyId);
    } else if (currencyList.some(c => c.code === currencyId)) {
        const currency = currencyList.find(c => c.code === currencyId);
        coin = {
            id: currency.code,
            name: currency.name,
            symbol: currency.code.toUpperCase(),
            icon: 'fas fa-money-bill-wave'
        };
    }

    if (coin) {
        button.innerHTML = `<i class="${coin.icon}"></i> <span>${coin.symbol}</span> <i class="fas fa-chevron-down"></i>`;
        button.setAttribute('data-currency', coin.id);
    }
}


function setupDropdownToggle(buttonId, dropdownId) {
    const button = document.getElementById(buttonId);
    const dropdown = document.getElementById(dropdownId);

    if (!button || !dropdown) return;

    button.addEventListener('click', function (e) {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });


    document.addEventListener('click', function () {
        dropdown.classList.remove('show');
    });
}


async function searchCoins() {
    const query = document.getElementById('coinSearch').value.trim();
    if (!query) return;

    try {
        const response = await fetch(`/api/search_coins?q=${encodeURIComponent(query)}&limit=10`);
        const data = await response.json();

        if (data.success) {
            displayCoinResults(data.results);
        }
    } catch (error) {
        console.error('Error searching coins:', error);
    }
}


function displayCoinResults(coins) {
    const resultsElement = document.getElementById('coinResults');
    resultsElement.innerHTML = '';

    if (coins.length === 0) {
        resultsElement.innerHTML = '<div class="coin-result" style="pointer-events: none; color: var(--text-tertiary);">No coins found</div>';
        resultsElement.classList.add('show');
        return;
    }

    coins.forEach(coin => {
        const result = document.createElement('div');
        result.className = 'coin-result';
        result.innerHTML = `
            <strong>${coin.name}</strong>
            <span style="color: var(--text-tertiary); margin-left: 8px;">${coin.symbol.toUpperCase()}</span>
        `;

        result.addEventListener('click', function () {
            document.getElementById('coinSearch').value = coin.id;
            document.getElementById('currentTrackingCoin').textContent = `${coin.name} (${coin.symbol.toUpperCase()})`;
            resultsElement.classList.remove('show');
        });

        resultsElement.appendChild(result);
    });

    resultsElement.classList.add('show');
}


async function saveSettings() {
    try {
        const primaryCurrency = document.getElementById('settingsCurrency').value;
        const trackingCoin = document.getElementById('coinSearch').value || 'bitcoin';

        const response = await fetch('/api/update_config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                primary_currency: primaryCurrency,
                tracking_coin: trackingCoin
            })
        });

        const data = await response.json();

        if (data.success) {

            document.getElementById('primaryCurrency').value = primaryCurrency;
            document.getElementById('track-coin-name').textContent = trackingCoin.charAt(0).toUpperCase() + trackingCoin.slice(1);
            document.getElementById('track-coin-symbol').textContent = trackingCoin.toUpperCase();


            loadData();

            showNotification('Settings saved successfully!', 'success');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Failed to save settings', 'error');
    }
}


function switchTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeButtons(theme);
}


function loadSavedTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    switchTheme(savedTheme);
}


function updateThemeButtons(theme) {
    const themeBtns = document.querySelectorAll('.theme-btn');
    themeBtns.forEach(btn => {
        if (btn.getAttribute('data-theme') === theme) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}


function startAutoRefresh() {
    if (countdownTimer) clearInterval(countdownTimer);

    countdownValue = refreshInterval / 1000;
    updateCountdown();

    countdownTimer = setInterval(function () {
        countdownValue--;
        updateCountdown();

        if (countdownValue <= 0) {
            loadData();
            countdownValue = refreshInterval / 1000;
        }
    }, 1000);
}

function stopAutoRefresh() {
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
    document.getElementById('countdown').textContent = '--';
}

function resetCountdown() {
    if (countdownTimer) {
        countdownValue = refreshInterval / 1000;
        updateCountdown();
    }
}

function updateCountdown() {
    const countdownElement = document.getElementById('countdown');
    if (countdownElement) {
        countdownElement.textContent = countdownValue;
    }
}


function showLoading(show) {
    if (show) {
        document.body.classList.add('loading');
    } else {
        document.body.classList.remove('loading');
    }
}


function showNotification(message, type = 'success') {

    const existing = document.querySelector('.notification');
    if (existing) existing.remove();


    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);


    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}


function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('lastUpdate').textContent = timeString;
}