// Production-Ready Constants - Centralized Configuration
// This file centralizes all hardcoded values for better maintainability

// Solana Network Configuration
const SOLANA_MAINNET_RPC = 'https://austbot-austbot-234b.mainnet.rpcpool.com/a30e04d0-d9d6-4ac1-8503-38217fdb2821';
const DRIFT_CLUSTER = process.env.DRIFT_CLUSTER || 'mainnet-beta';

// Token Addresses
const USDC_MINT_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const DRIFT_PROGRAM_ID_ADDRESS = 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH';

// Market Configuration
const SUPPORTED_MARKETS = {
  'SOL-PERP': 0,
  'BTC-PERP': 1,
  'ETH-PERP': 2
};

// Transaction Configuration
const COMPUTE_UNITS = {
  DEFAULT: 500000,
  WITHDRAWAL: 800000,
  CLOSE_POSITION: 500000,
  TRADE: 500000
};

// Rate Limiting Configuration
const RPC_CONFIG = {
  MIN_INTERVAL: 1000, // 1 second between calls
  MAX_RETRIES: 5,
  INITIAL_RETRY_DELAY: 1000,
  MAX_RETRY_DELAY: 10000
};

// Safety Buffers
const SAFETY_BUFFERS = {
  COLLATERAL_BUFFER: 0.35, // 35% safety buffer for trades
  WITHDRAWAL_BUFFER: 0.1,  // 10% safety buffer for withdrawals
  LEVERAGE_BUFFER: 0.05    // 5% buffer for leverage calculations
};

// WebSocket Configuration
const WEBSOCKET_CONFIG = {
  PRICE_UPDATE_INTERVAL: 5000,    // 5 seconds
  POSITION_UPDATE_INTERVAL: 15000, // 15 seconds
  HEARTBEAT_INTERVAL: 30000       // 30 seconds
};

// Server Configuration
const SERVER_CONFIG = {
  PORT: process.env.PORT || 3004,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
};

module.exports = {
  // Network
  SOLANA_MAINNET_RPC,
  DRIFT_CLUSTER,
  
  // Addresses
  USDC_MINT_ADDRESS,
  DRIFT_PROGRAM_ID_ADDRESS,
  
  // Markets
  SUPPORTED_MARKETS,
  
  // Transactions
  COMPUTE_UNITS,
  
  // Rate Limiting
  RPC_CONFIG,
  
  // Safety
  SAFETY_BUFFERS,
  
  // WebSocket
  WEBSOCKET_CONFIG,
  
  // Server
  SERVER_CONFIG
};
