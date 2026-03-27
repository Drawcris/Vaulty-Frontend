import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ethers } from 'ethers';

// Deklaracja typu dla window.ethereum (MetaMask)
declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  chainId: number | null;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private readonly CONNECTED_WALLET_KEY = 'vaulty_connected_wallet';
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;

  private walletState$ = new BehaviorSubject<WalletState>({
    address: null,
    isConnected: false,
    chainId: null,
    error: null
  });

  constructor() {
    this.initializeProvider();
    this.setupEventListeners();
    void this.restoreConnection();
  }

  /**
   * Inicjalizuj provider (MetaMask lub inny Ethereum provider)
   */
  private initializeProvider(): void {
    if (!this.isMetaMaskInstalled()) {
      this.updateState({ error: 'MetaMask not installed' });
      return;
    }

    this.provider = new ethers.BrowserProvider(window.ethereum);
  }

  /**
   * Sprawdź czy MetaMask jest zainstalowany
   */
  isMetaMaskInstalled(): boolean {
    return typeof window !== 'undefined' && !!window.ethereum;
  }

  /**
   * Połącz z wallet'em
   */
  async connectWallet(): Promise<string> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized. Is MetaMask installed?');
      }

      // Request dostępu do wallet'a
      const accounts = await window.ethereum?.request({
        method: 'eth_requestAccounts'
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from MetaMask');
      }

      const address = accounts[0];
      this.signer = await this.provider.getSigner();

      // Pobierz chain ID
      const network = await this.provider.getNetwork();

      this.updateState({
        address,
        isConnected: true,
        chainId: Number(network.chainId),
        error: null
      });
      this.storeConnectedWallet(address);

      console.log(`Connected to wallet: ${address} on chain ${network.chainId}`);

      return address;
    } catch (error) {
      const errorMessage = this.getReadableError(error, 'Failed to connect wallet');
      this.updateState({ error: errorMessage });
      throw error;
    }
  }

  /**
   * Podpisz wiadomość (challenge)
   */
  async signMessage(message: string): Promise<string> {
    try {
      if (!this.signer) {
        throw new Error('Signer not initialized. Connect wallet first.');
      }

      const signature = await this.signer.signMessage(message);
      console.log('Message signed successfully');

      return signature;
    } catch (error) {
      const errorMessage = this.getReadableError(error, 'Failed to sign message');
      this.updateState({ error: errorMessage });
      throw new Error(errorMessage);
    }
  }

  /**
   * Pobierz aktualny adres wallet'a
   */
  getWalletAddress(): string | null {
    return this.walletState$.value.address;
  }

  /**
   * Pobierz stan wallet'a jako observable
   */
  getWalletState$(): Observable<WalletState> {
    return this.walletState$.asObservable();
  }

  /**
   * Rozłącz wallet
   */
  async disconnect(): Promise<void> {
    try {
      // Clear signer i provider
      this.signer = null;
      this.clearStoredConnection();

      this.updateState({
        address: null,
        isConnected: false,
        chainId: null,
        error: null
      });

      console.log('Wallet disconnected');
    } catch (error) {
      const errorMessage = this.getReadableError(error, 'Failed to disconnect');
      this.updateState({ error: errorMessage });
      throw error;
    }
  }

  /**
   * Pobierz chain ID
   */
  getChainId(): number | null {
    return this.walletState$.value.chainId;
  }

  /**
   * Sprawdź czy wallet jest podłączony
   */
  isConnected(): boolean {
    return this.walletState$.value.isConnected;
  }

  /**
   * Setup event listeners dla zmian w wallet'u
   */
  private setupEventListeners(): void {
    if (!this.isMetaMaskInstalled()) return;

    const ethereum = window.ethereum;

    // Listen na zmianę konta
    ethereum.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        this.disconnect();
      } else {
        const address = accounts[0];
        this.storeConnectedWallet(address);
        void this.refreshConnection(address);
        console.log(`Account changed to: ${address}`);
      }
    });

    // Listen na zmianę sieci
    ethereum.on('chainChanged', (chainId: string) => {
      const chainIdNum = parseInt(chainId, 16);
      this.updateState({ chainId: chainIdNum });
      console.log(`Chain changed to: ${chainIdNum}`);
      // Opcjonalnie: reload aplikacji
      window.location.reload();
    });

    // Listen na disconnect
    ethereum.on('disconnect', () => {
      this.disconnect();
      console.log('Wallet disconnected');
    });
  }

  /**
   * Aktualizuj stan wallet'a
   */
  private updateState(partial: Partial<WalletState>): void {
    const currentState = this.walletState$.value;
    this.walletState$.next({ ...currentState, ...partial });
  }

  async restoreConnection(): Promise<boolean> {
    if (!this.provider || !window.ethereum) {
      return false;
    }

    const storedWallet = this.getStoredConnectedWallet();
    if (!storedWallet) {
      return false;
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_accounts'
      });

      if (!Array.isArray(accounts) || accounts.length === 0) {
        this.clearStoredConnection();
        return false;
      }

      const matchingAccount = accounts.find(
        (account: string) => account.toLowerCase() === storedWallet.toLowerCase()
      );

      if (!matchingAccount) {
        this.clearStoredConnection();
        return false;
      }

      await this.refreshConnection(matchingAccount);
      return true;
    } catch (error) {
      const errorMessage = this.getReadableError(error, 'Failed to restore wallet connection');
      this.updateState({ error: errorMessage });
      return false;
    }
  }

  private async refreshConnection(address?: string): Promise<void> {
    if (!this.provider) {
      return;
    }

    const signer = await this.provider.getSigner();
    const network = await this.provider.getNetwork();
    const signerAddress = address ?? (await signer.getAddress());

    this.signer = signer;
    this.updateState({
      address: signerAddress,
      isConnected: true,
      chainId: Number(network.chainId),
      error: null
    });
    this.storeConnectedWallet(signerAddress);
  }

  private getReadableError(error: unknown, fallback: string): string {
    if (typeof error === 'object' && error !== null) {
      const providerError = error as { code?: number; shortMessage?: string; message?: string };

      if (providerError.code === 4001) {
        return 'Podpis lub połączenie zostało anulowane w portfelu.';
      }

      if (providerError.shortMessage) {
        return providerError.shortMessage;
      }

      if (providerError.message) {
        return providerError.message;
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return fallback;
  }

  private storeConnectedWallet(address: string): void {
    try {
      localStorage.setItem(this.CONNECTED_WALLET_KEY, address);
    } catch (error) {
      console.error('Failed to store connected wallet:', error);
    }
  }

  private getStoredConnectedWallet(): string | null {
    try {
      return localStorage.getItem(this.CONNECTED_WALLET_KEY);
    } catch (error) {
      console.error('Failed to read connected wallet:', error);
      return null;
    }
  }

  private clearStoredConnection(): void {
    try {
      localStorage.removeItem(this.CONNECTED_WALLET_KEY);
    } catch (error) {
      console.error('Failed to clear connected wallet:', error);
    }
  }
}

