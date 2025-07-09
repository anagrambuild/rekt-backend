const { Connection, PublicKey } = require('@solana/web3.js');

// USDC Token Mint Address (USDC on Solana mainnet)
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const WALLET_ADDRESS = 'GKYPWkWtiXVPdzv6EimbTWx7PCL4Pv5wggTW5cFtCvYm';
const RPC_URL = 'https://austbot-austbot-234b.mainnet.rpcpool.com/a30e04d0-d9d6-4ac1-8503-38217fdb2821';

async function testUSDCBalance() {
    try {
        console.log('🔗 Connecting to Solana RPC...');
        const connection = new Connection(RPC_URL, 'confirmed');
        
        // Test connection
        const slot = await connection.getSlot();
        console.log(`✅ Connected to Solana RPC. Current slot: ${slot}`);
        
        // Get token accounts
        console.log(`🔍 Fetching token accounts for wallet: ${WALLET_ADDRESS}`);
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            new PublicKey(WALLET_ADDRESS),
            { mint: USDC_MINT }
        );
        
        console.log(`📊 Found ${tokenAccounts.value.length} USDC token accounts`);
        
        // Calculate total USDC balance
        let usdcBalance = 0;
        tokenAccounts.value.forEach((account, index) => {
            try {
                const amount = account.account.data.parsed.info.tokenAmount.uiAmount;
                console.log(`  - Account ${index + 1}: ${amount} USDC`);
                usdcBalance += amount;
            } catch (e) {
                console.error(`Error processing token account ${index}:`, e);
            }
        });
        
        console.log(`💰 Total USDC balance: $${usdcBalance.toFixed(2)}`);
        
    } catch (error) {
        console.error('❌ Error:', {
            message: error.message,
            stack: error.stack
        });
    }
}

testUSDCBalance();
