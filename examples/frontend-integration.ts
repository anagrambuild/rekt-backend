// Example integration code for React Native frontend
// This shows how to connect your React Native app to the backend

// API Service Example
class RektAPIService {
  private baseUrl: string;
  private ws: WebSocket | null = null;

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  // REST API Methods
  async getMarkets() {
    const response = await fetch(`${this.baseUrl}/api/v1/markets`);
    return response.json();
  }

  async getMarketPrice(symbol: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/markets/${symbol}/price`);
    return response.json();
  }

  async getUserPositions(wallet: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/markets/positions/${wallet}`);
    return response.json();
  }

  async placeOrder(orderData: any) {
    const response = await fetch(`${this.baseUrl}/api/v1/markets/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });
    return response.json();
  }

  // WebSocket Methods
  connectWebSocket(onMessage: (data: any) => void) {
    this.ws = new WebSocket(`ws://localhost:3001`);
    
    this.ws.onopen = () => {
      console.log('Connected to WebSocket');
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  subscribeToPriceUpdates(symbol: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        data: { channel: 'price', symbol }
      }));
    }
  }

  unsubscribeFromPriceUpdates(symbol: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        data: { channel: 'price', symbol }
      }));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// React Native Hook Example
/*
import { useState, useEffect } from 'react';

export const useRektAPI = () => {
  const [apiService] = useState(() => new RektAPIService());
  const [markets, setMarkets] = useState([]);
  const [prices, setPrices] = useState({});
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Connect to WebSocket
    apiService.connectWebSocket((data) => {
      if (data.type === 'price_update') {
        setPrices(prev => ({
          ...prev,
          [data.data.symbol]: data.data.price
        }));
      }
    });

    // Cleanup on unmount
    return () => {
      apiService.disconnect();
    };
  }, [apiService]);

  const fetchMarkets = async () => {
    setLoading(true);
    try {
      const response = await apiService.getMarkets();
      if (response.success) {
        setMarkets(response.data);
      }
    } catch (error) {
      console.error('Error fetching markets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPositions = async (wallet) => {
    setLoading(true);
    try {
      const response = await apiService.getUserPositions(wallet);
      if (response.success) {
        setPositions(response.data);
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
    } finally {
      setLoading(false);
    }
  };

  const placeOrder = async (orderData) => {
    setLoading(true);
    try {
      const response = await apiService.placeOrder(orderData);
      return response;
    } catch (error) {
      console.error('Error placing order:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const subscribeToPrices = (symbols) => {
    symbols.forEach(symbol => {
      apiService.subscribeToPriceUpdates(symbol);
    });
  };

  return {
    markets,
    prices,
    positions,
    loading,
    fetchMarkets,
    fetchUserPositions,
    placeOrder,
    subscribeToPrices,
  };
};
*/

export default RektAPIService;
