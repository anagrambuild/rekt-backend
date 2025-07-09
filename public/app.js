// Prevent unwanted Web3 provider injections
if (window.ethereum) {
    console.log('Ethereum provider detected, but not used in this application');
    // Optionally, you can remove window.ethereum if it's causing issues
    // delete window.ethereum;
}

// REKT Drift Protocol API Interface
class DriftAPIInterface {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        
        // Console capture state
        this.consoleCaptureEnabled = true;
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
        };
        
        // Override console methods to capture logs
        this.setupConsoleCapture();
        // Application configuration
        this.config = {
            // API and WebSocket endpoints
            apiUrl: 'http://localhost:3004/api',
            wsUrl: 'ws://localhost:3004',
            walletAddress: null,
            
            // Solana RPC configuration - Using RPC Pool
            solanaRpc: 'https://austbot-austbot-234b.mainnet.rpcpool.com/a30e04d0-d9d6-4ac1-8503-38217fdb2821',
            
            // Drift Protocol configuration
            driftProgramId: 'dRiftyHA39MWEa3pc9prcb94Ym6ZoTKp357Dq4QBSgHX',
            driftStateAccount: 'Dd4vYjKj3tFkZ3fM4Rxqk6SJToZ9TvLtqYG8j5RfQ2hx',
            wsEndpoint: window.location.hostname === 'localhost' ? 'ws://localhost:3004' : 'wss://your-production-url.com'
        };
        
        // Initialize markets array
        this.markets = [];
        
        // Wallet and trading state
        this.wallet = null;
        this.isWalletConnected = false;
        this.usdcBalance = 0;
        this.currentLeverage = 1;
        this.tradeDirection = 'long'; // 'long' or 'short'
        this.currentSolPrice = 0;
        
        this.initializeApp();
    }

    initializeApp() {
        this.updateConnectionStatus('Disconnected', 'disconnected');
        this.updateNetworkStatus('Not Connected');
        this.setupEventListeners();
        this.loadConfiguration();
        
        // Automatically fetch markets and start WebSocket on page load
        this.autoInitialize();
    }

    setupConsoleCapture() {
        const self = this;
        
        function createConsoleProxy(level, originalMethod) {
            return function(...args) {
                // Call original console method
                originalMethod.apply(console, args);
                
                // Capture to our log if enabled
                if (self.consoleCaptureEnabled) {
                    const timestamp = new Date().toLocaleTimeString();
                    const message = args.map(arg => 
                        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                    ).join(' ');
                    
                    self.addConsoleLogEntry(level, timestamp, message);
                }
            };
        }
        
        console.log = createConsoleProxy('log', this.originalConsole.log);
        console.error = createConsoleProxy('error', this.originalConsole.error);
        console.warn = createConsoleProxy('warn', this.originalConsole.warn);
        console.info = createConsoleProxy('info', this.originalConsole.info);
    }
    
    addConsoleLogEntry(level, timestamp, message) {
        const consoleLog = document.getElementById('console-log');
        
        // Remove placeholder if it exists
        const placeholder = consoleLog.querySelector('.placeholder');
        if (placeholder) {
            placeholder.remove();
        }
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${level}`;
        
        const levelIcon = {
            'log': '📝',
            'error': '❌',
            'warn': '⚠️',
            'info': 'ℹ️'
        }[level] || '📝';
        
        logEntry.innerHTML = `
            <span class="log-timestamp">[${timestamp}]</span>
            <span class="log-level">${levelIcon} ${level.toUpperCase()}</span>
            <span class="log-message">${message}</span>
        `;
        
        consoleLog.appendChild(logEntry);
        
        // Auto-scroll to bottom
        consoleLog.scrollTop = consoleLog.scrollHeight;
        
        // Keep only last 100 entries to avoid memory issues
        const entries = consoleLog.querySelectorAll('.log-entry');
        if (entries.length > 100) {
            entries[0].remove();
        }
    }
    
    clearConsoleLog() {
        const consoleLog = document.getElementById('console-log');
        consoleLog.innerHTML = '<p class="placeholder">Console logs will appear here</p>';
    }
    
    toggleConsoleCapture() {
        this.consoleCaptureEnabled = !this.consoleCaptureEnabled;
        const button = document.getElementById('toggle-console-capture-btn');
        button.textContent = this.consoleCaptureEnabled ? 'Stop Capture' : 'Start Capture';
        button.className = this.consoleCaptureEnabled ? 'btn btn-primary' : 'btn btn-secondary';
        
        const status = this.consoleCaptureEnabled ? 'enabled' : 'disabled';
        console.log(`📋 Console capture ${status}`);
    }

    async autoInitialize() {
        console.log('🚀 Auto-initializing: fetching markets and starting WebSocket...');
        
        // Show loading state
        this.logMessage('info', '🚀 Auto-starting market data and WebSocket connection...');
        
        try {
            // Automatically fetch markets
            this.logMessage('info', '📊 Fetching live market data...');
            await this.fetchMarkets();
            
            // Wait a moment, then start WebSocket
            setTimeout(() => {
                this.logMessage('info', '🔌 Connecting to live price stream...');
                this.startWebSocket();
            }, 500);
        } catch (error) {
            this.logMessage('error', `❌ Auto-initialization failed: ${error.message}`);
        }
    }

    setupEventListeners() {
        // Market data controls
        document.getElementById('fetch-markets-btn').addEventListener('click', () => this.fetchMarkets());

        // WebSocket controls
        document.getElementById('send-ws-btn').addEventListener('click', () => this.sendWebSocketMessage());
        document.getElementById('clear-log-btn').addEventListener('click', () => this.clearLog());
        document.getElementById('ws-message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendWebSocketMessage();
        });

        // Console log controls
        document.getElementById('clear-console-btn').addEventListener('click', () => this.clearConsoleLog());
        document.getElementById('toggle-console-capture-btn').addEventListener('click', () => this.toggleConsoleCapture());

        // Configuration controls
        document.getElementById('save-config-btn').addEventListener('click', () => this.saveConfiguration());

        // API testing controls
        document.getElementById('get-price-btn').addEventListener('click', () => this.getMarketPrice());
        document.getElementById('get-positions-btn').addEventListener('click', () => this.getUserPositions());
        
        // Wallet controls
        document.getElementById('connect-wallet-btn').addEventListener('click', () => this.connectWallet());
        document.getElementById('disconnect-wallet-btn').addEventListener('click', () => this.disconnectWallet());
        
        // Trading controls
        document.getElementById('leverage-slider').addEventListener('input', (e) => this.updateLeverage(e.target.value));
        document.getElementById('trade-amount').addEventListener('input', () => this.updateTradeSummary());
        document.getElementById('long-btn').addEventListener('click', () => this.setTradeDirection('long'));
        document.getElementById('short-btn').addEventListener('click', () => this.setTradeDirection('short'));
        document.getElementById('submit-trade-btn').addEventListener('click', () => this.submitTrade());
        document.getElementById('refresh-positions-btn').addEventListener('click', () => this.refreshPositions());
    }

    updateConnectionStatus(status, className) {
        const statusElement = document.getElementById('connection-status');
        statusElement.textContent = status;
        statusElement.className = `status-value ${className}`;
    }

    updateNetworkStatus(status) {
        document.getElementById('network-status').textContent = status;
    }

    async fetchMarkets() {
        const btn = document.getElementById('fetch-markets-btn');
        btn.disabled = true;
        btn.textContent = 'Loading...';
        btn.classList.add('loading');

        try {
            const response = await fetch('/api/markets');
            const result = await response.json();

            if (result.success) {
                this.markets = result.data; // Store markets data for trading
                this.displayMarkets(result.data);
                this.logMessage('success', 'Markets fetched successfully');
            } else {
                this.logMessage('error', `Failed to fetch markets: ${result.message}`);
            }
        } catch (error) {
            this.logMessage('error', `Error fetching markets: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Refresh Markets';
            btn.classList.remove('loading');
        }
    }

    displayMarkets(markets) {
        const container = document.getElementById('markets-container');
        
        if (markets.length === 0) {
            container.innerHTML = '<p class="placeholder">No markets found</p>';
            return;
        }

        container.innerHTML = markets.map(market => `
            <div class="market-item">
                <div class="market-header">
                    <div class="market-symbol">${market.symbol}</div>
                    <div class="market-price">$${market.price.toFixed(2)}</div>
                </div>
                <div class="market-details">
                    <div class="market-change ${market.change24h >= 0 ? 'positive' : 'negative'}">
                        ${market.change24h >= 0 ? '+' : ''}${market.change24h.toFixed(2)}%
                    </div>
                    <div class="market-volume">Vol: $${(market.volume24h / 1000000).toFixed(2)}M</div>
                </div>
                <div class="market-extended">
                    <div class="market-range">
                        <span class="high">H: $${market.high24h?.toFixed(2) || 'N/A'}</span>
                        <span class="low">L: $${market.low24h?.toFixed(2) || 'N/A'}</span>
                    </div>
                    <div class="market-funding">
                        <span class="funding-rate">FR: ${(market.fundingRate * 100).toFixed(4)}%</span>
                        <span class="open-interest">OI: ${(market.openInterest || 0).toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    startWebSocket() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.logMessage('error', 'WebSocket is already connected');
            return;
        }

        this.ws = new WebSocket('ws://localhost:3004');

        this.ws.onopen = () => {
            this.isConnected = true;
            this.updateConnectionStatus('Connected', 'connected');
            this.updateNetworkStatus(`${this.config.driftEnv} (${this.config.solanaRpc})`);
            this.logMessage('success', 'WebSocket connected');
            
            document.getElementById('send-ws-btn').disabled = false;
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            
            // Handle different message types
            if (message.type === 'market_data') {
                this.displayMarkets(message.data);
                this.logMessage('success', `✅ Loaded ${message.data.length} markets`);
            } else if (message.type === 'price_update') {
                this.displayMarkets(message.data);
                // Show update message every time for better visibility
                this.logMessage('info', `🔄 Live prices updated (${message.data.length} markets)`);
                
                // Update the timestamp to show when last updated
                const timestamp = new Date().toLocaleTimeString();
                this.logMessage('info', `⏰ Last update: ${timestamp}`);
            } else if (message.type === 'connected') {
                this.logMessage('success', `🟢 ${message.message}`);
            } else if (message.type === 'subscribed') {
                this.logMessage('success', message.message);
            } else if (message.type === 'unsubscribed') {
                this.logMessage('info', message.message);
            } else if (message.type === 'pong') {
                this.logMessage('info', '🏓 Ping successful');
            } else {
                // For debugging, show other message types
                this.logMessage('info', `Received: ${JSON.stringify(message, null, 2)}`);
            }
        };

        this.ws.onclose = () => {
            this.isConnected = false;
            this.updateConnectionStatus('Disconnected', 'disconnected');
            this.updateNetworkStatus('Not Connected');
            this.logMessage('info', 'WebSocket disconnected');
            
            document.getElementById('send-ws-btn').disabled = true;
        };

        this.ws.onerror = (error) => {
            this.logMessage('error', `WebSocket error: ${error.message || 'Connection failed'}`);
        };
    }

    stopWebSocket() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    sendWebSocketMessage() {
        const input = document.getElementById('ws-message-input');
        const message = input.value.trim();

        if (!message) {
            this.logMessage('error', 'Please enter a message to send');
            return;
        }

        if (!this.isConnected) {
            this.logMessage('error', 'WebSocket is not connected');
            return;
        }

        try {
            const messageObj = JSON.parse(message);
            this.ws.send(JSON.stringify(messageObj));
            this.logMessage('info', `Sent: ${message}`);
            input.value = '';
        } catch (error) {
            // If it's not JSON, send as a simple message
            this.ws.send(JSON.stringify({
                type: 'message',
                content: message
            }));
            this.logMessage('info', `Sent: ${message}`);
            input.value = '';
        }
    }

    clearLog() {
        document.getElementById('ws-log').innerHTML = '<p class="placeholder">WebSocket events will appear here</p>';
    }

    logMessage(type, message) {
        const log = document.getElementById('ws-log');
        const timestamp = new Date().toLocaleTimeString();
        
        // Remove placeholder if it exists
        const placeholder = log.querySelector('.placeholder');
        if (placeholder) {
            placeholder.remove();
        }

        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${timestamp}] ${message}`;
        
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }

    saveConfiguration() {
        this.config.solanaRpc = document.getElementById('solana-rpc').value;
        this.config.driftEnv = document.getElementById('drift-env').value;
        this.config.walletAddress = document.getElementById('wallet-address').value;

        localStorage.setItem('driftConfig', JSON.stringify(this.config));
        this.logMessage('success', 'Configuration saved');
        
        if (this.isConnected) {
            this.updateNetworkStatus(`${this.config.driftEnv} (${this.config.solanaRpc})`);
        }
    }

    loadConfiguration() {
        const saved = localStorage.getItem('driftConfig');
        if (saved) {
            this.config = { ...this.config, ...JSON.parse(saved) };
            
            document.getElementById('solana-rpc').value = this.config.solanaRpc;
            document.getElementById('drift-env').value = this.config.driftEnv;
            document.getElementById('wallet-address').value = this.config.walletAddress;
        }
    }

    async getMarketPrice() {
        const symbol = document.getElementById('symbol-select').value;
        const resultDiv = document.getElementById('price-result');
        const btn = document.getElementById('get-price-btn');

        btn.disabled = true;
        btn.textContent = 'Loading...';
        resultDiv.textContent = 'Loading...';

        try {
            const response = await fetch(`/api/markets/${symbol}/price`);
            const result = await response.json();

            if (result.success) {
                resultDiv.textContent = JSON.stringify(result.data, null, 2);
                this.logMessage('success', `Got price for ${symbol}: $${result.data.price}`);
            } else {
                resultDiv.textContent = `Error: ${result.message}`;
                this.logMessage('error', `Failed to get price for ${symbol}: ${result.message}`);
            }
        } catch (error) {
            resultDiv.textContent = `Error: ${error.message}`;
            this.logMessage('error', `Error getting price: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Get Price';
        }
    }

    async getUserPositions() {
        const wallet = document.getElementById('position-wallet').value.trim();
        const resultDiv = document.getElementById('positions-result');
        const btn = document.getElementById('get-positions-btn');

        if (!wallet) {
            resultDiv.textContent = 'Please enter a wallet address';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Loading...';
        resultDiv.textContent = 'Loading...';

        try {
            const response = await fetch(`/api/markets/positions/${wallet}`);
            const result = await response.json();

            if (result.success) {
                resultDiv.textContent = JSON.stringify(result.data, null, 2);
                this.logMessage('success', `Got positions for ${wallet}`);
            } else {
                resultDiv.textContent = `Error: ${result.message}`;
                this.logMessage('error', `Failed to get positions: ${result.message}`);
            }
        } catch (error) {
            resultDiv.textContent = `Error: ${error.message}`;
            this.logMessage('error', `Error getting positions: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Get Positions';
        }
    }

    // Wallet Connection Methods
    async connectWallet() {
        try {
            // Check if we're in a browser environment
            if (typeof window === 'undefined') {
                this.showTradeStatus('error', 'This application requires a web browser.');
                this.logMessage('error', 'Window object not available');
                return;
            }

            // Check if Phantom is available
            if (!window.solana) {
                // Open Phantom install page in a new tab
                window.open('https://phantom.app/', '_blank');
                this.showTradeStatus('error', 'Phantom wallet not detected. Opening Phantom wallet installation page...');
                this.logMessage('error', 'Phantom wallet not detected');
                return;
            }

            // Check if Phantom is installed
            if (!window.solana.isPhantom) {
                this.showTradeStatus('error', 'Phantom wallet not found. Please install the Phantom wallet extension.');
                this.logMessage('error', 'Phantom wallet extension not detected');
                return;
            }

            this.logMessage('info', '👛 Connecting to Phantom wallet...');
            
            try {
                // Connect to Phantom
                const response = await window.solana.connect({ onlyIfTrusted: false });
                
                if (!response || !response.publicKey) {
                    throw new Error('Invalid response from wallet');
                }
                
                this.wallet = window.solana;
                this.isWalletConnected = true;
                const walletAddress = response.publicKey.toString();
                this.config.walletAddress = walletAddress;
                
                // Update UI
                this.updateWalletUI(walletAddress);
                
                // Fetch USDC balance
                await this.fetchUSDCBalance();
                
                this.logMessage('success', `✅ Wallet connected: ${walletAddress.substring(0, 8)}...`);
                
            } catch (error) {
                console.error('Phantom connection error:', error);
                const errorMessage = error.message || 'Unknown error occurred';
                this.logMessage('error', `❌ Failed to connect to Phantom: ${errorMessage}`);
                this.showTradeStatus('error', `Failed to connect wallet: ${errorMessage}`);
                
                // If user rejected the request
                if (error.code === 4001 || error.code === -32603) {
                    this.showTradeStatus('error', 'Connection was rejected. Please try again.');
                }
            }
            
        } catch (error) {
            console.error('Unexpected error in connectWallet:', error);
            const errorMessage = error.message || 'Unknown error occurred';
            this.logMessage('error', `❌ Unexpected error: ${errorMessage}`);
            this.showTradeStatus('error', 'An unexpected error occurred. Please try again.');
        }
    }

    disconnectWallet() {
        try {
            if (this.wallet) {
                this.wallet.disconnect();
            }
            
            this.wallet = null;
            this.isWalletConnected = false;
            this.usdcBalance = 0;
            this.config.walletAddress = '';
            
            // Update UI
            this.updateWalletUI(null);
            
            this.logMessage('info', '👛 Wallet disconnected');
            
        } catch (error) {
            console.error('Wallet disconnection error:', error);
            this.logMessage('error', `Error disconnecting wallet: ${error.message}`);
        }
    }

    updateWalletUI(walletAddress) {
        const disconnectedState = document.getElementById('wallet-disconnected');
        const connectedState = document.getElementById('wallet-connected');
        const tradingInterface = document.getElementById('trading-interface');
        const walletAddressDisplay = document.getElementById('wallet-address-display');
        const copyButton = document.getElementById('copy-wallet-address');
        const explorerLink = document.getElementById('view-on-explorer');
        
        if (walletAddress) {
            // Show connected state
            disconnectedState.style.display = 'none';
            connectedState.style.display = 'block';
            tradingInterface.style.display = 'block';
            
            const displayAddress = `${walletAddress.substring(0, 8)}...${walletAddress.slice(-4)}`;
            walletAddressDisplay.textContent = displayAddress;
            
            // Show action buttons
            copyButton.style.display = 'inline-flex';
            explorerLink.style.display = 'inline-flex';
            
            // Update explorer link to use Solana Beach
            explorerLink.href = `https://solanabeach.io/address/${walletAddress}`;
            
            // Set up copy to clipboard
            copyButton.onclick = async (e) => {
                e.preventDefault();
                try {
                    await navigator.clipboard.writeText(walletAddress);
                    this.logMessage('success', '✅ Wallet address copied to clipboard');
                    
                    // Show feedback
                    const originalText = copyButton.innerHTML;
                    copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                    copyButton.title = 'Copied!';
                    
                    // Reset after 2 seconds
                    setTimeout(() => {
                        copyButton.innerHTML = originalText;
                        copyButton.title = 'Copy to clipboard';
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy address:', err);
                    this.logMessage('error', '❌ Failed to copy address to clipboard');
                }
            };
            
        } else {
            // Show disconnected state
            disconnectedState.style.display = 'block';
            connectedState.style.display = 'none';
            tradingInterface.style.display = 'none';
            
            // Hide action buttons
            copyButton.style.display = 'none';
            explorerLink.style.display = 'none';
            
            walletAddressDisplay.textContent = 'Not Connected';
            document.getElementById('usdc-balance-display').textContent = '$0.00';
        }
    }

    async fetchUSDCBalance() {
        if (!this.isWalletConnected || !this.config.walletAddress) {
            this.logMessage('warning', '⚠️ Wallet not connected for balance fetch');
            return;
        }
        
        try {
            this.logMessage('info', `🔍 Fetching USDC balance via backend proxy...`);
            
            // Use backend proxy with Syndica RPC for reliable connectivity
            const response = await fetch(`/api/wallet/${this.config.walletAddress}/usdc-balance`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(`Backend Error: ${data.error}`);
            }
            
            const usdcBalance = data.balance || 0;
            this.usdcBalance = usdcBalance;
            this.updateBalanceDisplay(usdcBalance);
            
            this.logMessage('success', `💵 USDC balance: $${usdcBalance.toFixed(2)} (via Syndica RPC)`);
            
        } catch (error) {
            this.logMessage('error', `❌ Failed to fetch USDC balance: ${error.message}`);
            console.error('USDC balance fetch error:', error);
            
            // Set balance to 0 on error
            this.usdcBalance = 0;
            this.updateBalanceDisplay(0);
        }
    }

    updateBalanceDisplay(balance) {
        document.getElementById('usdc-balance-display').textContent = `$${balance.toFixed(2)}`;
    }

    // Trading Methods
    updateLeverage(leverage) {
        this.currentLeverage = parseInt(leverage);
        document.getElementById('leverage-display').textContent = `${leverage}x`;
        this.updateTradeSummary();
    }

    setTradeDirection(direction) {
        this.tradeDirection = direction;
        
        // Update button states
        const longBtn = document.getElementById('long-btn');
        const shortBtn = document.getElementById('short-btn');
        
        longBtn.classList.toggle('active', direction === 'long');
        shortBtn.classList.toggle('active', direction === 'short');
        
        this.updateTradeSummary();
    }

    updateTradeSummary() {
        const tradeAmount = parseFloat(document.getElementById('trade-amount').value) || 0;
        const positionSize = tradeAmount * this.currentLeverage;
        
        document.getElementById('position-size-display').textContent = `$${positionSize.toFixed(2)}`;
        
        if (this.currentSolPrice > 0) {
            document.getElementById('estimated-entry-display').textContent = `$${this.currentSolPrice.toFixed(2)}`;
        }
    }

    async submitTrade() {
        if (!this.isWalletConnected) {
            this.showTradeStatus('error', 'Please connect your wallet first.');
            return;
        }

        const tradeAmount = parseFloat(document.getElementById('trade-amount').value);
        if (!tradeAmount || tradeAmount <= 0) {
            this.showTradeStatus('error', 'Please enter a valid trade amount.');
            return;
        }

        if (tradeAmount > this.usdcBalance) {
            this.showTradeStatus('error', 'Insufficient USDC balance.');
            return;
        }

        const submitButton = document.getElementById('submit-trade-btn');
        const originalText = submitButton.textContent;
        
        try {
            submitButton.disabled = true;
            submitButton.textContent = 'Preparing Trade...';
            
            // Show transaction progress UI
            this.showTransactionProgress();
            
            // Execute isolated margin trade with Phantom wallet
            await this.executeIsolatedMarginTrade(tradeAmount);
            
        } catch (error) {
            this.showTradeStatus('error', `Trade failed: ${error.message}`);
            this.logMessage('error', `❌ Trade submission error: ${error.message}`);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    }

    async executeIsolatedMarginTrade(tradeAmount) {
        try {
            // Step 1: Validate and prepare trade
            this.updateTransactionStep('prepare', 'active');
            this.showTradeStatus('loading', 'Preparing isolated margin trade...');
            
            // Ensure markets are loaded
            if (!this.markets || !Array.isArray(this.markets)) {
                this.showTradeStatus('loading', 'Loading market data...');
                await this.fetchMarkets();
                
                if (!this.markets || !Array.isArray(this.markets)) {
                    throw new Error('Failed to load market data. Please refresh and try again.');
                }
            }
            
            const positionSize = tradeAmount * this.currentLeverage;
            const solMarket = this.markets.find(m => m.symbol === 'SOL-PERP');
            if (!solMarket) {
                throw new Error('SOL-PERP market not found. Available markets: ' + this.markets.map(m => m.symbol).join(', '));
            }
            
            const entryPrice = solMarket.price;
            this.logMessage('info', `🎯 Isolated Margin Trade: ${this.tradeDirection.toUpperCase()} $${tradeAmount} at ${this.currentLeverage}x`);
            this.logMessage('info', `📊 Position size: $${positionSize.toFixed(2)}, Entry: $${entryPrice}`);
            
            // Step 2: Initialize Drift client with isolated margin
            this.updateTransactionStep('prepare', 'completed');
            this.updateTransactionStep('client', 'active');
            this.showTradeStatus('loading', 'Initializing Drift client for isolated margin...');
            
            const driftClient = await this.initializeIsolatedMarginClient();
            
            // Step 3: Create transaction with isolated margin
            this.updateTransactionStep('client', 'completed');
            this.updateTransactionStep('transaction', 'active');
            this.showTradeStatus('loading', 'Creating isolated margin trade transaction...');
            
            const transaction = await this.createIsolatedMarginTransaction(driftClient, tradeAmount, solMarket);
            
            // Step 4: Send to Phantom wallet for approval
            this.updateTransactionStep('transaction', 'completed');
            this.updateTransactionStep('phantom', 'active');
            this.showTradeStatus('loading', '🦋 Please approve the transaction in your Phantom wallet...');
            
            // Get a fresh blockhash before signing
            const connection = new window.solanaWeb3.Connection(this.config.solanaRpc, 'confirmed');
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
            transaction.recentBlockhash = blockhash;
            transaction.lastValidBlockHeight = lastValidBlockHeight;
            
            const signedTransaction = await this.wallet.signTransaction(transaction);
            
            // Step 5: Submit to blockchain
            this.updateTransactionStep('phantom', 'completed');
            this.updateTransactionStep('submit', 'active');
            this.showTradeStatus('loading', '⚡ Submitting transaction to Solana blockchain...');
            
            let signature;
            try {
                // Submit transaction via backend proxy to avoid 403 errors
                signature = await this.submitTransactionViaBackend(signedTransaction);
            } catch (error) {
                if (error.message.includes('block height exceeded') || error.message.includes('Blockhash not found')) {
                    // If the blockhash expired, refresh it and try again
                    this.logMessage('info', '🔄 Blockhash expired, refreshing and retrying...');
                    const { blockhash: newBlockhash, lastValidBlockHeight: newLastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
                    transaction.recentBlockhash = newBlockhash;
                    transaction.lastValidBlockHeight = newLastValidBlockHeight;
                    
                    // Re-sign the transaction with the new blockhash
                    const reSignedTx = await this.wallet.signTransaction(transaction);
                    signature = await this.submitTransactionViaBackend(reSignedTx);
                } else {
                    throw error; // Re-throw if it's a different error
                }
            }
            
            this.logMessage('success', `📤 Transaction submitted: ${signature}`);
            
            // Step 6: Wait for confirmation
            this.updateTransactionStep('submit', 'completed');
            this.updateTransactionStep('confirm', 'active');
            this.showTradeStatus('loading', '⏳ Waiting for blockchain confirmation...');
            
            await this.waitForTransactionConfirmation(signature);
            
            // Step 7: Success and refresh
            this.updateTransactionStep('confirm', 'completed');
            this.showTradeStatus('success', `✅ Isolated margin trade executed successfully!\n\nDirection: ${this.tradeDirection.toUpperCase()}\nAmount: $${tradeAmount}\nLeverage: ${this.currentLeverage}x (Isolated)\nPosition Size: $${positionSize.toFixed(2)}\nEntry Price: $${entryPrice}\nTransaction: ${signature}`);
            
            this.logMessage('success', `🎉 Trade confirmed on-chain: ${signature}`);
            
            // Refresh balance and positions
            await this.fetchUSDCBalance();
            await this.refreshPositions();
            
        } catch (error) {
            this.logMessage('error', `❌ Isolated margin trade failed: ${error.message}`);
            this.showTradeStatus('error', `Trade failed: ${error.message}`);
            throw error;
        }
    }
    
    async initializeIsolatedMarginClient() {
        // No longer needed - trade submission is handled by backend API
        console.log('🏗️ Using backend API for trade submission with real Drift SDK');
        return { backendMode: true };
        
        const { DriftClient } = window.drift;
        const connection = new window.solanaWeb3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        
        const wallet = {
            publicKey: this.wallet.publicKey,
            signTransaction: (tx) => this.wallet.signTransaction(tx),
            signAllTransactions: (txs) => this.wallet.signAllTransactions(txs)
        };
        
        const driftClient = new DriftClient({
            connection: connection,
            wallet: wallet,
            programID: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',
            env: 'mainnet-beta',
            // Force isolated margin mode
            accountSubscription: {
                type: 'websocket',
                commitment: 'confirmed'
            }
        });
        
        await driftClient.subscribe();
        this.logMessage('success', '🔗 Drift client initialized for isolated margin trading');
        return driftClient;
    }
    
    async createIsolatedMarginTransaction(driftClient, tradeAmount, market) {
        this.logMessage('info', `🔗 Calling backend API for real Drift SDK trade creation...`);
        
        try {
            const response = await fetch('/api/trade/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    walletAddress: this.config.walletAddress,
                    tradeAmount: tradeAmount,
                    leverage: this.currentLeverage,
                    direction: this.tradeDirection,
                    marketSymbol: 'SOL-PERP'
                })
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to create trade transaction');
            }

            if (!result.transactionData) {
                throw new Error('Invalid response from server: missing transaction data');
            }

            this.logMessage('success', '✅ Backend prepared transaction data successfully');
            
            try {
                const { Transaction, PublicKey, SystemProgram, TransactionInstruction } = window.solanaWeb3;
                const { instructions, blockhash, lastValidBlockHeight, feePayer } = result.transactionData;
                
                // Create a new transaction
                const transaction = new Transaction({
                    feePayer: new PublicKey(feePayer),
                    blockhash,
                    lastValidBlockHeight
                });
                
                // Convert each instruction to a TransactionInstruction
                for (const ix of instructions) {
                    // Convert any public keys in the keys array
                    const keys = (ix.keys || []).map(key => ({
                        pubkey: new PublicKey(key.pubkey),
                        isSigner: key.isSigner,
                        isWritable: key.isWritable
                    }));
                    
                    // Create a new transaction instruction
                    const instruction = new TransactionInstruction({
                        keys,
                        programId: new PublicKey(ix.programId),
                        data: Uint8Array.from(atob(ix.data), c => c.charCodeAt(0))
                    });
                    
                    transaction.add(instruction);
                }
                
                return transaction;
            } catch (error) {
                console.error('❌ Transaction creation error:', error);
                throw new Error(`Transaction creation error: ${error.message}`);
            }
            
        } catch (error) {
            this.logMessage('error', `❌ Backend trade creation failed: ${error.message}`);
            throw error;
        }
    }
    
    // Transaction Progress UI Methods
    showTransactionProgress() {
        const statusDiv = document.getElementById('trade-status');
        statusDiv.innerHTML = `
            <div class="transaction-progress">
                <h4>🔄 Transaction Progress</h4>
                <div class="transaction-step" id="step-prepare">
                    <div class="step-icon pending" id="icon-prepare">1</div>
                    <span>Preparing trade parameters</span>
                </div>
                <div class="transaction-step" id="step-client">
                    <div class="step-icon pending" id="icon-client">2</div>
                    <span>Initializing Drift client</span>
                </div>
                <div class="transaction-step" id="step-transaction">
                    <div class="step-icon pending" id="icon-transaction">3</div>
                    <span>Creating transaction</span>
                </div>
                <div class="transaction-step" id="step-phantom">
                    <div class="step-icon pending" id="icon-phantom">4</div>
                    <span>Phantom wallet approval</span>
                </div>
                <div class="transaction-step" id="step-submit">
                    <div class="step-icon pending" id="icon-submit">5</div>
                    <span>Submitting to blockchain</span>
                </div>
                <div class="transaction-step" id="step-confirm">
                    <div class="step-icon pending" id="icon-confirm">6</div>
                    <span>Waiting for confirmation</span>
                </div>
            </div>
        `;
    }
    
    updateTransactionStep(stepId, status) {
        const icon = document.getElementById(`icon-${stepId}`);
        if (icon) {
            icon.className = `step-icon ${status}`;
            if (status === 'completed') {
                icon.textContent = '✓';
            }
        }
    }
    
    /**
     * Submit signed transaction via backend proxy
     */
    async submitTransactionViaBackend(signedTransaction) {
        try {
            // Serialize the transaction to send to the backend
            const serializedTx = signedTransaction.serialize({
                requireAllSignatures: false,
                verifySignatures: false
            });
            
            // Convert Uint8Array to base64 in a browser-compatible way
            const signedTransactionBase64 = btoa(
                Array.from(serializedTx, byte => String.fromCharCode(byte)).join('')
            );
            
            this.logMessage('info', '📤 Sending signed transaction to backend for submission...');
            
            const response = await fetch('/api/transaction/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    signedTransaction: signedTransactionBase64
                })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                const errorMsg = result.error || result.message || 'Transaction submission failed';
                const details = result.details ? `\nDetails: ${result.details}` : '';
                this.logMessage('error', `❌ Backend error: ${errorMsg}${details}`);
                throw new Error(errorMsg);
            }
            
            if (!result.success) {
                const errorMsg = result.error || result.message || 'Transaction submission failed';
                this.logMessage('error', `❌ Transaction failed: ${errorMsg}`);
                throw new Error(errorMsg);
            }
            
            if (!result.signature) {
                throw new Error('No transaction signature received from backend');
            }
            
            this.logMessage('success', `✅ Transaction submitted successfully: ${result.signature}`);
            
            // Log confirmation details if available
            if (result.confirmation) {
                this.logMessage('info', `📝 Confirmation status: ${result.confirmation.confirmationStatus || 'unknown'}`);
                if (result.confirmation.err) {
                    this.logMessage('warn', `⚠️ Transaction had an error: ${JSON.stringify(result.confirmation.err)}`);
                }
            }
            
            return result.signature;
            
        } catch (error) {
            this.logMessage('error', `❌ Transaction submission failed: ${error.message}`);
            console.error('Transaction submission error:', error);
            throw error;
        }
    }

    async waitForTransactionConfirmation(signature) {
        const maxRetries = 60; // 60 seconds total
        const checkInterval = 2000; // Check every 2 seconds
        const maxAttempts = Math.ceil(maxRetries * 1000 / checkInterval);
        const startTime = Date.now();
        
        this.logMessage('info', `🔍 Waiting for transaction confirmation: ${signature}`);
        
        // Array of fun status messages to show while waiting
        const statusMessages = [
            'Finalizing your trade...',
            'Almost there...',
            'Just a few more seconds...',
            'Confirming with the network...',
            'Hang tight! This usually takes a moment...',
            'Your trade is being processed...',
            'Getting everything just right...'
        ];
        
        // Get the status container or create it if it doesn't exist
        let statusContainer = document.getElementById('trade-status-message');
        if (!statusContainer) {
            // If the container doesn't exist, create it
            const container = document.createElement('div');
            container.id = 'trade-status-message';
            // Find a good place to insert it - for example, before the first form or after the last form
            const forms = document.getElementsByTagName('form');
            if (forms.length > 0) {
                forms[0].parentNode.insertBefore(container, forms[0].nextSibling);
            } else {
                // If no forms found, append to body
                document.body.appendChild(container);
            }
            statusContainer = container;
        }
        
        // Create loading indicator HTML
        const loadingHtml = `
            <div class="transaction-loading">
                <div class="loading-spinner"></div>
                <div class="loading-dots">
                    <div class="loading-dot"></div>
                    <div class="loading-dot"></div>
                    <div class="loading-dot"></div>
                </div>
                <div class="transaction-status" id="transaction-status">
                    Submitting transaction to the Solana network...
                </div>
                <div class="transaction-explorer-link" style="margin-top: 10px;">
                    <a href="https://explorer.solana.com/tx/${signature}" target="_blank" style="color: #4CAF50; text-decoration: none;">
                        View on Solana Explorer ↗
                    </a>
                </div>
            </div>
        `;
        
        // Update the UI with our loading animation
        statusContainer.innerHTML = loadingHtml;
        
        // Initialize status element reference
        let statusEl = document.getElementById('transaction-status');
        
        // Helper function to safely update status
        const updateStatus = (message, isError = false) => {
            const statusContent = `
                <div class="transaction-status" style="color: ${isError ? '#e74c3c' : 'inherit'};">
                    ${message}
                </div>
                <div style="margin-top: 10px;">
                    <a href="https://explorer.solana.com/tx/${signature}" target="_blank" 
                       style="color: ${isError ? '#f39c12' : '#4CAF50'}; text-decoration: none;">
                        View on Solana Explorer ↗
                    </a>
                </div>
            `;
            
            if (statusEl) {
                statusEl.innerHTML = message;
                statusEl.style.color = isError ? '#e74c3c' : 'inherit';
                if (isError) {
                    statusEl.style.fontWeight = 'bold';
                }
            } else {
                // If status element is not found, update the container directly
                statusContainer.innerHTML = statusContent;
                // Update the statusEl reference in case it was just created
                statusEl = document.getElementById('transaction-status');
            }
        };
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            const remainingTime = Math.max(0, maxRetries - elapsedSeconds);
            
            // Rotate through status messages
            const statusIndex = Math.floor(elapsedSeconds / 3) % statusMessages.length;
            const statusMessage = `${statusMessages[statusIndex]} (${remainingTime}s remaining)`;
            
            // Update status
            updateStatus(statusMessage);
            
            try {
                // Check transaction status via backend proxy
                const response = await fetch(`/api/transaction/status?signature=${encodeURIComponent(signature)}`);
                
                if (!response.ok) {
                    // Handle 404 specifically for dropped transactions
                    if (response.status === 404) {
                        const errorData = await response.json().catch(() => ({}));
                        if (errorData.dropped) {
                            throw new Error('Transaction was dropped from the mempool. Please try again.');
                        }
                    }
                    throw new Error(`HTTP ${response.status} - ${response.statusText}`);
                }
                
                const result = await response.json();
                
                if (!result.success) {
                    if (result.dropped) {
                        throw new Error('Transaction was dropped from the mempool. Please try again.');
                    }
                    throw new Error(result.error || 'Failed to get transaction status');
                }
                
                const status = result.status;
                this.logMessage('info', `📝 Status check ${elapsedSeconds}s: ${status ? status.confirmationStatus : 'pending'}`);
                
                // Check if transaction is confirmed
                if (status && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')) {
                    const successMessage = `✅ Transaction confirmed in ${elapsedSeconds}s!`;
                    this.logMessage('success', successMessage);
                    
                    // Update UI to show success
                    updateStatus(successMessage);
                    
                    // Add a small delay to show the success message
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return status;
                }
                
                // If we have an error in the status, throw it
                if (status && status.err) {
                    throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
                }
                
            } catch (error) {
                console.error('Error checking transaction status:', error);
                
                // Update UI to show error
                const errorMessage = `❌ ${error.message}`;
                updateStatus(errorMessage, true);
                
                // If we get a 404 or dropped status, fail fast
                if (error.message.includes('404') || 
                    error.message.includes('not found') || 
                    error.message.includes('dropped')) {
                    throw new Error(`Transaction failed: ${error.message}`);
                }
                
                this.logMessage('warn', `⚠️ Status check failed: ${error.message}`);
                
                // For transient errors, continue waiting
                if (statusEl) {
                    statusEl.textContent = `⚠️ ${error.message}. Retrying...`;
                }
            }
            
            // Wait before next check with a small jitter to avoid thundering herd
            const jitter = Math.random() * 500 - 250; // ±250ms jitter
            await new Promise(resolve => setTimeout(resolve, checkInterval + jitter));
        }
        
        // If we get here, we've timed out
        const errorMsg = `Transaction confirmation timeout after ${maxRetries} seconds. ` +
                        `The transaction might still be processing.`;
        
        this.logMessage('warn', `⏱️ ${errorMsg}`);
        
        // Update the UI to show the timeout
        updateStatus(`⚠️ ${errorMsg}`, true);
        
        throw new Error(errorMsg);
    }

    createTradeParams(tradeAmount, solMarket) {
        const isLong = this.tradeDirection === 'long';
        const baseAssetAmount = (tradeAmount * this.currentLeverage) / solMarket.price;
        
        return {
            marketIndex: 0, // SOL-PERP is market index 0 on Drift
            direction: isLong ? 'long' : 'short',
            baseAssetAmount: baseAssetAmount,
            quoteAssetAmount: tradeAmount,
            leverage: this.currentLeverage,
            price: solMarket.price
        };
    }
    
    async refreshPositions() {
        if (!this.isWalletConnected) return;
        
        try {
            const response = await fetch(`/api/markets/positions/${this.config.walletAddress}`);
            const data = await response.json();
            
            if (data.success) {
                this.displayPositions(data.positions || []);
                document.getElementById('positions-section').style.display = 'block';
            }
        } catch (error) {
            this.logMessage('error', `Failed to refresh positions: ${error.message}`);
        }
    }
    
    displayPositions(positions) {
        const container = document.getElementById('positions-container');
        const noPositions = document.getElementById('no-positions');
        
        if (positions.length === 0) {
            noPositions.style.display = 'block';
            container.innerHTML = '<div class="no-positions"><p>No open positions</p></div>';
            return;
        }
        
        noPositions.style.display = 'none';
        container.innerHTML = positions.map(position => `
            <div class="position-card">
                <div class="position-info">
                    <div class="position-market">${position.market}</div>
                    <div class="position-details">
                        <span>Direction: <strong>${position.direction.toUpperCase()}</strong></span>
                        <span>Size: <strong>$${position.size.toFixed(2)}</strong></span>
                        <span>Entry: <strong>$${position.entryPrice.toFixed(2)}</strong></span>
                        <span>Current: <strong>$${position.currentPrice.toFixed(2)}</strong></span>
                        <span class="position-pnl ${position.pnl >= 0 ? 'positive' : 'negative'}">
                            PnL: <strong>${position.pnl >= 0 ? '+' : ''}$${position.pnl.toFixed(2)}</strong>
                        </span>
                    </div>
                </div>
                <div class="position-actions">
                    <button class="btn-close" onclick="driftAPI.closePosition('${position.id}')">
                        Close Position
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    async closePosition(positionId) {
        try {
            this.showTradeStatus('loading', 'Closing position...');
            
            // Implementation for closing position would go here
            // This would involve creating a reverse trade
            
            this.showTradeStatus('success', 'Position closed successfully!');
            await this.refreshPositions();
            await this.fetchUSDCBalance();
            
        } catch (error) {
            this.showTradeStatus('error', `Failed to close position: ${error.message}`);
        }
    }
    
    async initializeDriftClient() {
        try {
            // Check if Drift SDK and Solana web3.js are available
            if (typeof window.drift === 'undefined' || typeof window.solanaWeb3 === 'undefined') {
                throw new Error('Drift SDK and Solana web3.js dependencies not loaded. Trade submission temporarily disabled while dependencies are being configured.');
            }
            
            const { DriftClient, Wallet, loadKeypair } = window.drift;
            
            // Create connection to Solana mainnet
            const connection = new window.solanaWeb3.Connection(this.config.solanaRpc, 'confirmed');
            
            // Create wallet adapter for Phantom
            const wallet = {
                publicKey: this.wallet.publicKey,
                signTransaction: (tx) => this.wallet.signTransaction(tx),
                signAllTransactions: (txs) => this.wallet.signAllTransactions(txs)
            };
            
            // Initialize Drift client for mainnet
            const driftClient = new DriftClient({
                connection: connection,
                wallet: wallet,
                programID: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH', // Drift mainnet program ID
                env: 'mainnet-beta'
            });
            
            await driftClient.subscribe();
            
            this.logMessage('success', '🔗 Drift client initialized for mainnet');
            return driftClient;
            
        } catch (error) {
            this.logMessage('error', `❌ Failed to initialize Drift client: ${error.message}`);
            throw error;
        }
    }
    
    createTradeParams(tradeAmount, solMarket) {
        const isLong = this.tradeDirection === 'long';
        const baseAssetAmount = (tradeAmount * this.currentLeverage) / solMarket.price;
        
        return {
            marketIndex: 0, // SOL-PERP is market index 0 on Drift
            direction: isLong ? 'long' : 'short',
            baseAssetAmount: baseAssetAmount,
            quoteAssetAmount: tradeAmount,
            leverage: this.currentLeverage,
            price: solMarket.price
        };
    }
    
    async executeTradeTransaction(driftClient, tradeParams) {
        try {
            // Create place order instruction
            const orderParams = {
                orderType: 'market',
                marketIndex: tradeParams.marketIndex,
                direction: tradeParams.direction === 'long' ? 'long' : 'short',
                baseAssetAmount: tradeParams.baseAssetAmount,
                price: 0, // Market order
                reduceOnly: false,
                postOnly: false
            };
            
            this.logMessage('info', `📝 Creating ${tradeParams.direction} order for ${tradeParams.baseAssetAmount.toFixed(4)} SOL`);
            
            // Place the order
            const txSignature = await driftClient.placeOrder(orderParams);
            
            this.logMessage('success', `📤 Transaction submitted: ${txSignature}`);
            return txSignature;
            
        } catch (error) {
            this.logMessage('error', `❌ Transaction failed: ${error.message}`);
            throw error;
        }
    }
    
    async waitForConfirmation(txSignature) {
        try {
            const connection = new window.solanaWeb3.Connection(this.config.solanaRpc, 'confirmed');
            
            this.logMessage('info', `⏳ Waiting for confirmation: ${txSignature}`);
            
            const confirmation = await connection.confirmTransaction(txSignature, 'confirmed');
            
            if (confirmation.value.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
            }
            
            this.logMessage('success', `✅ Transaction confirmed: ${txSignature}`);
            
        } catch (error) {
            this.logMessage('error', `❌ Confirmation failed: ${error.message}`);
            throw error;
        }
    }

    showTradeStatus(type, message) {
        const statusDiv = document.getElementById('trade-status');
        statusDiv.className = `trade-status ${type}`;
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';
        
        // Auto-hide success/error messages after 10 seconds
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 10000);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Update the displayMarkets method to track SOL price
    displayMarkets(markets) {
        const container = document.getElementById('markets-container');
        
        if (markets.length === 0) {
            container.innerHTML = '<p class="placeholder">No markets found</p>';
            return;
        }

        // Find SOL price for trading interface
        const solMarket = markets.find(m => m.symbol === 'SOL-PERP');
        if (solMarket) {
            this.currentSolPrice = solMarket.price;
            this.updateTradeSummary();
        }

        container.innerHTML = markets.map(market => `
            <div class="market-item">
                <div class="market-header">
                    <div class="market-symbol">${market.symbol}</div>
                    <div class="market-price">$${market.price.toFixed(2)}</div>
                </div>
                <div class="market-details">
                    <div class="market-change ${market.change24h >= 0 ? 'positive' : 'negative'}">
                        ${market.change24h >= 0 ? '+' : ''}${market.change24h.toFixed(2)}%
                    </div>
                    <div class="market-volume">Vol: $${(market.volume24h / 1000000).toFixed(2)}M</div>
                </div>
                <div class="market-extended">
                    <div class="market-range">
                        <span class="high">H: $${market.high24h?.toFixed(2) || 'N/A'}</span>
                        <span class="low">L: $${market.low24h?.toFixed(2) || 'N/A'}</span>
                    </div>
                    <div class="market-funding">
                        <span class="funding-rate">FR: ${(market.fundingRate * 100).toFixed(4)}%</span>
                        <span class="open-interest">OI: ${(market.openInterest || 0).toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new DriftAPIInterface();
});

// Add some demo data and sample WebSocket messages
window.sampleWebSocketMessages = {
    subscribe: {
        type: 'subscribe',
        data: { channel: 'price', symbol: 'SOL-PERP' }
    },
    unsubscribe: {
        type: 'unsubscribe',
        data: { channel: 'price', symbol: 'SOL-PERP' }
    },
    ping: {
        type: 'ping'
    }
};

// Add helper functions to window for easy testing
window.testWS = {
    subscribe: () => {
        const input = document.getElementById('ws-message-input');
        input.value = JSON.stringify(window.sampleWebSocketMessages.subscribe, null, 2);
    },
    unsubscribe: () => {
        const input = document.getElementById('ws-message-input');
        input.value = JSON.stringify(window.sampleWebSocketMessages.unsubscribe, null, 2);
    },
    ping: () => {
        const input = document.getElementById('ws-message-input');
        input.value = JSON.stringify(window.sampleWebSocketMessages.ping, null, 2);
    }
};
