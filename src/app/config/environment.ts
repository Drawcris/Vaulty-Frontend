/**
 * Environment configuration for Vaulty application
 * Change API_BASE_URL to match your backend server
 */

export const environment = {
  production: false,

  // ===== IMPORTANT: Update this to your backend server address =====
  // For development: http://localhost:8000
  // For production: https://api.vaulty.app (or your domain)
  API_BASE_URL: getApiBaseUrl(),

  // Application metadata
  APP_NAME: 'Vaulty',
  APP_VERSION: '1.0.0',

  // Blockchain & Web3
  SUPPORTED_CHAIN_ID: 1, // Ethereum mainnet (change to 11155111 for Sepolia testnet)
  METAMASK_REQUIRED: true,
};

/**
 * Auto-detect API base URL based on hostname
 */
function getApiBaseUrl(): string {
  const hostname = window.location.hostname;

  // Production domains
  if (hostname.includes('vaulty.app') || hostname.includes('vaulty.io')) {
    return 'https://api.vaulty.app';
  }

  // Development / Local
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Change port if backend is running on different port
    const port = 8000;
    return `http://${hostname}:${port}`;
  }

  // Custom domains
  return `http://${hostname}:8000`;
}

/**
 * Configuration instructions:
 *
 * 1. Local Development:
 *    - Backend should run on http://localhost:8000
 *    - Frontend will use http://localhost:4200
 *    - CORS is configured on backend
 *
 * 2. Custom Domain:
 *    - Update getApiBaseUrl() to return your API domain
 *    - Make sure CORS is configured on backend
 *    - Example: https://api.vaulty.app or https://your-domain.com:8000
 *
 * 3. MetaMask Settings:
 *    - MetaMask will see the domain from browser URL bar
 *    - Not "localhost" but your actual domain
 *    - Good practice: use vaulty.local for local testing with custom hosts file
 */

