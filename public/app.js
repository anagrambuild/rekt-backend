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
            wsEndpoint: window.location.hostname === 'localhost' ? 'ws://localhost:3004' : 'wss://your-production-url.com',
            walletAddress: null,
            connection: null,
            driftClient: null,
            ws: null,
            currentLeverage: 5, // Default leverage
            currentDirection: 'long', // Default direction
            refreshInterval: null,
            positionRefreshInterval: 30000, // 30 seconds
            positionRefreshTimer: null, // For tracking the position refresh interval
            isRefreshingPositions: false // To prevent concurrent refreshes
        };
        
        // Initialize markets array
        this.markets = [];
        
        // Wallet and trading state
        this.wallet = null;
        this.isWalletConnected = false;
        this.usdcBalance = 0;
        this.currentSolPrice = 0;
        
        // Initialize trading direction (fix for toUpperCase error)
        this.tradeDirection = this.config.currentDirection || 'long';
        // Initialize leverage value to ensure it's defined before any trade submissions
        this.currentLeverage = this.config.currentLeverage || 1;
        
        this.initializeApp();
    }

    initializeApp() {
        this.setupEventListeners();
        this.initializeWallet();
        this.initializeMarkets();
        this.initializeTradingInterface();
        this.setupPositionRefresh();
        
        // Auto-start market data and WebSocket for live updates
        this.autoInitialize();
        
        console.log('✅ DriftAPIInterface initialized');
    }
    
    /**
     * Initialize wallet connection state and UI
     */
    initializeWallet() {
        // Check if we're in a browser environment
        if (typeof window === 'undefined') {
            return;
        }
        
        // Try to auto-connect to Phantom wallet if available
        if (window.solana?.isPhantom) {
            this.logMessage('info', '👛 Phantom wallet detected');
            // Auto-connect if previously connected
            if (window.solana.isConnected) {
                this.connectWallet().catch(error => {
                    console.error('Error during auto-connect:', error);
                });
            }
        } else {
            this.logMessage('warn', 'Phantom wallet not detected');
        }
        
        // Initialize wallet UI in disconnected state
        this.updateWalletUI(null);
    }
    
    /**
     * Initialize markets data and UI
     */
    initializeMarkets() {
        // Initialize markets array if not already done
        if (!this.markets || !Array.isArray(this.markets)) {
            this.markets = [];
        }
        
        // Initial fetch of markets data
        this.fetchMarkets().catch(error => {
            console.error('Error initializing markets:', error);
            this.logMessage('error', 'Failed to load markets data');
            
            // Show placeholder markets if the fetch fails
            this.displayMarkets([
                {
                    symbol: 'SOL-PERP',
                    price: 0,
                    change24h: 0,
                    volume24h: 0,
                    high24h: 0,
                    low24h: 0,
                    fundingRate: 0,
                    openInterest: 0
                }
            ]);
        });
        
        // Set up periodic refresh of markets data
        if (this.marketRefreshInterval) {
            clearInterval(this.marketRefreshInterval);
        }
        
        // Refresh markets every 30 seconds
        this.marketRefreshInterval = setInterval(() => {
            this.fetchMarkets().catch(error => {
                console.error('Error refreshing markets:', error);
            });
        }, 30000);
    }
    
    /**
     * Initialize the trading interface elements and event listeners
     */
    initializeTradingInterface() {
        // Initialize trade amount input
        const amountInput = document.getElementById('trade-amount');
        if (amountInput) {
            amountInput.addEventListener('input', () => this.updateTradeSummary());
        }
        
        // Initialize leverage slider
        const leverageSlider = document.getElementById('leverage-slider');
        const leverageValue = document.getElementById('leverage-value');
        if (leverageSlider && leverageValue) {
            leverageSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                leverageValue.textContent = `${value}x`;
                this.updateLeverage(parseInt(value, 10));
                this.updateTradeSummary();
            });
        }
        
        // Initialize direction buttons
        const longBtn = document.getElementById('direction-long');
        const shortBtn = document.getElementById('direction-short');
        if (longBtn && shortBtn) {
            longBtn.addEventListener('click', () => this.setTradeDirection('long'));
            shortBtn.addEventListener('click', () => this.setTradeDirection('short'));
        }
        
        // Initialize trade button
        const tradeButton = document.getElementById('place-trade');
        if (tradeButton) {
            tradeButton.addEventListener('click', () => this.submitTrade());
        }
        
        // Initialize refresh button
        const refreshBtn = document.getElementById('refresh-positions');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshPositions());
        }
        
        console.log('✅ Trading interface initialized');
    }
    
    /**
     * Connect to WebSocket server for real-time updates
     */
    connectWebSocket() {
        try {
            // Close existing connection if any
            if (this.ws) {
                this.ws.close();
            }
            
            // Create new WebSocket connection
            this.ws = new WebSocket(this.config.wsEndpoint);
            
            // Connection opened
            this.ws.addEventListener('open', () => {
                console.log('✅ Connected to WebSocket server');
                this.isConnected = true;
                this.updateConnectionStatus('Connected', 'success');
                
                // Subscribe to updates
                this.ws.send(JSON.stringify({
                    type: 'subscribe',
                    channel: 'trades',
                    symbol: 'SOL-PERP'
                }));
            });
            
            // Listen for messages
            this.ws.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            });
            
            // Handle connection close
            this.ws.addEventListener('close', () => {
                console.log('❌ Disconnected from WebSocket server');
                this.isConnected = false;
                this.updateConnectionStatus('Disconnected', 'error');
                
                // Attempt to reconnect after a delay
                setTimeout(() => this.connectWebSocket(), 5000);
            });
            
            // Handle errors
            this.ws.addEventListener('error', (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('Connection error', 'error');
            });
            
        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
            this.updateConnectionStatus('Connection failed', 'error');
            
            // Retry connection after a delay
            setTimeout(() => this.connectWebSocket(), 5000);
        }
    }
    
    /**
     * Handle incoming WebSocket messages
     * @param {Object} message - The WebSocket message
     */
    handleWebSocketMessage(message) {
        if (!message || !message.type) return;
        
        switch (message.type) {
            case 'price_update': // Backend sends 'price_update'
            case 'priceUpdate':
                this.handlePriceUpdate(message.data);
                break;
            case 'trade':
                this.handleTradeUpdate(message.data);
                break;
            case 'position':
                this.handlePositionUpdate(message.data);
                break;
            case 'connected':
                console.log('✅ WebSocket connection established');
                break;
            default:
                console.log('Unhandled WebSocket message type:', message.type);
        }
    }
    
    handlePriceUpdate(markets) {
        if (!markets || !Array.isArray(markets)) return;
        
        // Update the markets data
        this.markets = markets;
        
        // Update the UI with new prices
        this.displayMarkets(markets);
        
        // Update SOL price for trading calculations
        const solMarket = markets.find(m => m.symbol === 'SOL-PERP');
        if (solMarket) {
            this.currentSolPrice = solMarket.price;
            // Update any price displays in trading interface
            const priceDisplay = document.getElementById('sol-price-display');
            if (priceDisplay) {
                priceDisplay.textContent = `$${solMarket.price.toFixed(2)}`;
            }
        }
        
        console.log('📊 Price update received:', markets.length, 'markets');
    }
    
    handleTradeUpdate(data) {
        console.log('💹 Trade update:', data);
        // Handle trade updates if needed
    }
    
    handlePositionUpdate(data) {
        console.log('📈 Position update:', data);
        // Handle position updates if needed
        if (this.config.walletAddress) {
            this.refreshPositions();
        }
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
        // This method is kept for compatibility but doesn't need to do anything
        // since we're always showing 'Solana' as the network name
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
                
                // Show loading state for positions
                const container = document.getElementById('positions-container');
                if (container) {
                    container.innerHTML = [
                        '<div class="no-positions">',
                        '    <p>Loading positions...</p>',
                        '</div>'
                    ].join('\n');
                }
                
                // Set up position refresh interval
                this.setupPositionRefresh();
                
                // Fetch initial data
                await Promise.all([
                    this.fetchUSDCBalance(),
                    this.fetchMarkets(),
                    this.refreshPositions()
                ]);
                
                this.logMessage('success', `✅ Wallet connected: ${walletAddress.substring(0, 8)}...`);
                
                // Connect WebSocket for real-time updates
                this.connectWebSocket();
                
            } catch (error) {
                console.error('Phantom connection error:', error);
                const errorMessage = error.message || 'Unknown error occurred';
                this.logMessage('error', `❌ Failed to connect to Phantom: ${errorMessage}`);
                this.showTradeStatus('error', `Failed to connect wallet: ${errorMessage}`);
                
                // Show error in positions container
                const container = document.getElementById('positions-container');
                if (container) {
                    container.innerHTML = [
                        '<div class="error-message">',
                        '    <p>Failed to connect wallet</p>',
                        '    <p class="small">' + this.escapeHtml(errorMessage) + '</p>',
                        '    <button class="btn btn-sm btn-retry" onclick="driftAPI.connectWallet()">',
                        '        Try Again',
                        '    </button>',
                        '</div>'
                    ].join('\n');
                }
                
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
            
            // Show error in positions container
            const container = document.getElementById('positions-container');
            if (container) {
                container.innerHTML = [
                    '<div class="error-message">',
                    '    <p>Connection error</p>',
                    '    <p class="small">' + this.escapeHtml(errorMessage) + '</p>',
                    '    <button class="btn btn-sm btn-retry" onclick="driftAPI.connectWallet()">',
                    '        Try Again',
                    '    </button>',
                    '</div>'
                ].join('\n');
            }
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
            this.showTradeStatus('loading', 'Preparing trade...');
            
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
            this.logMessage('info', `🎯 Trade: ${this.tradeDirection.toUpperCase()} $${tradeAmount} at ${this.currentLeverage}x`);
            this.logMessage('info', `📊 Position size: $${positionSize.toFixed(2)}, Entry: $${entryPrice}`);
            
            // Step 2: Submit to backend API
            this.updateTransactionStep('prepare', 'completed');
            this.updateTransactionStep('transaction', 'active');
            this.showTradeStatus('loading', 'Creating trade transaction via backend API...');
            
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
            
            if (!response.ok) {
                throw new Error(`Trade submission failed: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Trade submission failed');
            }
            
            // Safely determine instructions count to avoid runtime errors if backend omits the field
const instructionsLen = result?.instructions
    ? (Array.isArray(result.instructions) ? result.instructions.length : 1)
    : (result?.data?.instructions
        ? (Array.isArray(result.data.instructions) ? result.data.instructions.length : 1)
        : 'N/A');
this.logMessage('success', `📤 Trade instructions created: ${instructionsLen} instructions`);
            
            // Step 3: Sign transaction with Phantom
            this.updateTransactionStep('transaction', 'completed');
            this.updateTransactionStep('phantom', 'active');
            this.showTradeStatus('loading', '🦋 Please approve the transaction in your Phantom wallet...');
            
            // Deserialize the transaction from the backend
            let transaction;
            if (result.transaction) {
                // Legacy path: backend returned base64-encoded transaction
                const txUint8 = Uint8Array.from(atob(result.transaction), c => c.charCodeAt(0));
                transaction = window.solanaWeb3.Transaction.from(txUint8);
            } else if (result.transactionData) {
                // New structured path: rebuild transaction from instructions
                const { transactionData } = result;

                transaction = new window.solanaWeb3.Transaction({
                    recentBlockhash: transactionData.blockhash,
                    feePayer: new window.solanaWeb3.PublicKey(transactionData.feePayer)
                });

                transactionData.instructions.forEach(ix => {
                    const dataUint8 = Uint8Array.from(atob(ix.data), ch => ch.charCodeAt(0));
                    transaction.add(new window.solanaWeb3.TransactionInstruction({
                        programId: new window.solanaWeb3.PublicKey(ix.programId),
                        data: dataUint8,
                        keys: ix.keys.map(k => ({
                            pubkey: new window.solanaWeb3.PublicKey(k.pubkey),
                            isSigner: k.isSigner,
                            isWritable: k.isWritable
                        }))
                    }));
                });
            } else {
                throw new Error('Backend did not return transaction data');
            }
            
            // Sign the transaction
            const signedTransaction = await this.wallet.signTransaction(transaction);
            
            // Step 4: Submit to blockchain
            this.updateTransactionStep('phantom', 'completed');
            this.updateTransactionStep('submit', 'active');
            this.showTradeStatus('loading', '⚡ Submitting transaction to Solana blockchain...');
            
            // Submit transaction via backend proxy
            const signature = await this.submitTransactionViaBackend(signedTransaction);
            
            this.logMessage('success', `📤 Transaction submitted: ${signature}`);
            
            // Step 5: Wait for confirmation
            this.updateTransactionStep('submit', 'completed');
            this.updateTransactionStep('confirm', 'active');
            this.showTradeStatus('loading', '⏳ Waiting for blockchain confirmation...');
            
            await this.waitForTransactionConfirmation(signature);
            
            // Step 6: Success and refresh
            this.updateTransactionStep('confirm', 'completed');
            this.showTradeStatus('success', `✅ Trade executed successfully!\n\nDirection: ${this.tradeDirection.toUpperCase()}\nAmount: $${tradeAmount}\nLeverage: ${this.currentLeverage}x\nPosition Size: $${positionSize.toFixed(2)}\nEntry Price: $${entryPrice}\nTransaction: ${signature}`);
            
            // Auto-refresh positions after successful trade
            setTimeout(() => {
                this.refreshPositions();
            }, 2000);
            
        } catch (error) {
            this.logMessage('error', `❌ Trade failed: ${error.message}`);
            this.showTradeStatus('error', `Trade failed: ${error.message}`);
            throw error;
        }
    }

    // Note: initializeIsolatedMarginClient no longer needed with backend API approach
    
    // Note: createIsolatedMarginTransaction no longer needed with backend API approach
    
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

    async waitForTransactionConfirmation(signature, maxRetries = 60) {
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



    // Helper method to escape HTML content
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    async refreshPositions() {
        // Prevent concurrent refreshes
        if (this.config.isRefreshingPositions) {
            console.log('Position refresh already in progress, skipping...');
            return;
        }
        
        const container = document.getElementById('positions-container');
        if (!container) {
            console.error('Positions container not found');
            return;
        }
        
        // Show loading state
        const refreshBtn = document.getElementById('refresh-positions-btn');
        const originalBtnText = refreshBtn ? refreshBtn.textContent : 'Refresh';
        
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.textContent = 'Refreshing...';
        }
        
        // Set loading state
        this.config.isRefreshingPositions = true;
        container.classList.add('loading');
        
        try {
            if (!this.config.walletAddress) {
                container.innerHTML = `
                    <div class="no-positions">
                        <p>Connect your wallet to view positions</p>
                    </div>`;
                return;
            }
            
            console.log('🔄 Fetching positions for wallet:', this.config.walletAddress);
            
            // Use backend API to get real positions from Drift SDK
            const response = await fetch(`/api/markets/positions/${this.config.walletAddress}`);
        
            if (!response.ok) {
                throw new Error(`Failed to fetch positions: ${response.status} ${response.statusText}`);
            }
        
            const result = await response.json();
        
            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch positions');
            }
        
            const positions = result.positions || [];
            
            // Update the UI with the positions
            this.displayPositions(positions);
            
            // Update last updated timestamp
            const now = new Date();
            console.log(`✅ Fetched ${positions.length} positions at ${now.toLocaleTimeString()}`);
            
            // Dispatch custom event for other components to listen to
            document.dispatchEvent(new CustomEvent('positions-updated', { 
                detail: { 
                    positions: positions,
                    timestamp: now.toISOString()
                } 
            }));
            
        } catch (error) {
            console.error('❌ Error in refreshPositions:', error);
            this.logMessage('error', 'Failed to refresh positions: ' + error.message);
            
            // Show error in UI
            if (container) {
                container.innerHTML = `
                    <div class="error-message">
                        <p>Failed to load positions</p>
                        <p class="small">${this.escapeHtml(error.message)}</p>
                        <button class="btn btn-sm btn-retry" onclick="driftAPI.refreshPositions()">
                            Retry
                        </button>
                    </div>`;
            }
                
        } finally {
            // Reset loading state
            this.config.isRefreshingPositions = false;
            if (container) {
                container.classList.remove('loading');
            }
            
            // Reset refresh button
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = originalBtnText;
            }
        }
    }
    
    displayPositions(positions) {
        const container = document.getElementById('positions-container');
        if (!container) return;
        
        if (!positions || positions.length === 0) {
            container.innerHTML = `
                <div class="no-positions">
                    <p>No open positions found</p>
                    <p class="small">Your open positions will appear here</p>
                </div>`;
            return;
        }
        
        container.innerHTML = positions.map(position => {
            // Format values
            const direction = position.direction || 'long';
            const size = parseFloat(position.size || 0).toFixed(4);
            const entryPrice = parseFloat(position.entryPrice || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4
            });
            const currentPrice = parseFloat(position.currentPrice || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4
            });
            const pnl = parseFloat(position.pnl || 0);
            const pnlPercentage = parseFloat(position.pnlPercentage || 0);
            const leverage = parseFloat(position.leverage || 1).toFixed(1);
            const marketSymbol = position.market ? position.market.split('-')[0] : 'SOL';
            
            // Determine PnL class and sign
            const pnlClass = pnl >= 0 ? 'positive' : 'negative';
            const pnlSign = pnl >= 0 ? '+' : '';
            
            return `
            <div class="position-card">
                <div class="position-header">
                    <span class="position-market">${position.market || 'N/A'}</span>
                    <span class="position-direction ${direction}">${direction.toUpperCase()}</span>
                    <span class="position-leverage">${leverage}x</span>
                </div>
                <div class="position-details">
                    <div class="position-row">
                        <span>Size:</span>
                        <strong>${size} ${marketSymbol}</strong>
                    </div>
                    <div class="position-row">
                        <span>Entry Price:</span>
                        <strong>$${entryPrice}</strong>
                    </div>
                    <div class="position-row">
                        <span>Mark Price:</span>
                        <strong>$${currentPrice}</strong>
                    </div>
                    <div class="position-pnl ${pnlClass}">
                        <span>PnL:</span>
                        <strong>${pnlSign}$${Math.abs(pnl).toFixed(2)} (${pnlSign}${Math.abs(pnlPercentage).toFixed(2)}%)</strong>
                    </div>
                </div>
                <div class="position-actions">
                    <button class="btn-close" onclick="driftAPI.closePosition('${position.id || ''}')">
                        Close Position
                    </button>
                </div>
            </div>`;
        }).join('');
    }
    
    async closePosition(positionId) {
        try {
            if (!positionId) {
                throw new Error('No position ID provided');
            }
            
            this.showTradeStatus('loading', 'Closing position...');
            
            // Get the position details to determine the market and direction
            const response = await fetch(`/api/markets/positions/${this.config.walletAddress}`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error('Failed to fetch position details');
            }
            
            const position = data.positions?.find(p => p.id === positionId);
            if (!position) {
                throw new Error('Position not found');
            }
            
            // Call the close position API
            const closeResponse = await fetch('/api/trade/close', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    walletAddress: this.config.walletAddress,
                    market: position.market,
                    direction: position.direction,
                    size: position.size.toString()
                })
            });
            
            const result = await closeResponse.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to close position');
            }
            
            this.showTradeStatus('success', 'Position closed successfully!');
            
            // Refresh positions and balance
            await Promise.all([
                this.refreshPositions(),
                this.fetchUSDCBalance()
            ]);
            
        } catch (error) {
            this.showTradeStatus('error', `Failed to close position: ${error.message}`);
        }
    }
    
    // Note: Drift client functionality is now handled by backend APIs
    // This is more efficient than bundling the entire SDK in the browser
    
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

    /**
     * Sets up a periodic refresh of the user's positions
     * This method is called during app initialization and after wallet connection
     */
    setupPositionRefresh() {
        // Clear any existing timer to avoid duplicates
        if (this.config.positionRefreshTimer) {
            clearInterval(this.config.positionRefreshTimer);
            this.config.positionRefreshTimer = null;
        }

        // Only set up the timer if we have a connected wallet
        if (this.config.walletAddress) {
            // Initial refresh
            this.refreshPositions().catch(error => {
                console.error('Error in initial position refresh:', error);
            });

            // Set up periodic refresh
            this.config.positionRefreshTimer = setInterval(() => {
                // Only refresh if not already refreshing
                if (!this.config.isRefreshingPositions) {
                    this.refreshPositions().catch(error => {
                        console.error('Error in periodic position refresh:', error);
                    });
                }
            }, this.config.positionRefreshInterval);

            console.log(`✅ Position auto-refresh enabled (every ${this.config.positionRefreshInterval / 1000} seconds)`);
        } else {
            console.log('Position auto-refresh not started: No wallet connected');
        }
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

// Note: Initialization is now handled by the HTML file to ensure proper dependency loading

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
