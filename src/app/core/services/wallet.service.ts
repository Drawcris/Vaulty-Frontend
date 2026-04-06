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
  private connectionPromise: Promise<string> | null = null;
  private initializationPromise: Promise<boolean> | null = null;

  private walletState$ = new BehaviorSubject<WalletState>({
    address: null,
    isConnected: false,
    chainId: null,
    error: null
  });

  constructor() {
    this.initializeProvider();
    this.setupEventListeners();
    // Nie blokujemy konstruktora, ale zapisujemy stan inicjalizacji
    this.initializationPromise = this.restoreConnection();
  }

  /**
   * Inicjalizuj provider
   */
  private initializeProvider(): void {
    if (!this.isMetaMaskInstalled()) {
      this.updateState({ error: 'Brak MetaMask' });
      return;
    }

    this.provider = new ethers.BrowserProvider(window.ethereum);
  }

  isMetaMaskInstalled(): boolean {
    return typeof window !== 'undefined' && !!window.ethereum;
  }

  /**
   * Wrapper z timeoutem dla operacji na portfelu
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number = 15000): Promise<T> {
    let timeoutId: any;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Przekroczono czas oczekiwania na MetaMask (timeout). Spróbuj odświeżyć stronę.'));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Połącz z walletem (z blokadą przed wyścigiem i timeoutem)
   */
  async connectWallet(): Promise<string> {
    // Jeśli już połączony, zwróć adres
    if (this.walletState$.value.isConnected && this.walletState$.value.address) {
      return this.walletState$.value.address;
    }

    if (this.connectionPromise) {
      console.log('[WalletService] Połączenie w toku, czekam...');
      return this.connectionPromise;
    }

    this.connectionPromise = this._performConnection();
    try {
      return await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async _performConnection(): Promise<string> {
    try {
      if (!this.provider) {
        throw new Error('Provider nie zainicjalizowany. Czy MetaMask jest zainstalowany?');
      }

      console.log('[WalletService] Wysyłanie eth_requestAccounts...');
      // eth_requestAccounts często wisi jeśli MetaMask jest zablokowany
      const accounts = await this.withTimeout(
        window.ethereum.request({ method: 'eth_requestAccounts' }),
        20000 
      ) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error('Nie odnaleziono kont w MetaMask.');
      }

      const address = accounts[0];
      console.log('[WalletService] Pobieranie signera...');
      this.signer = await this.withTimeout(this.provider.getSigner(), 5000);

      const network = await this.withTimeout(this.provider.getNetwork(), 5000);

      this.updateState({
        address,
        isConnected: true,
        chainId: Number(network.chainId),
        error: null
      });
      this.storeConnectedWallet(address);

      return address;
    } catch (error) {
      const errorMessage = this.getReadableError(error, 'Problem z połączeniem MetaMask');
      this.updateState({ error: errorMessage });
      throw new Error(errorMessage);
    }
  }

  /**
   * Podpisz wiadomość (challenge)
   */
  async signMessage(message: string): Promise<string> {
    try {
      if (!this.signer) {
        this.signer = await this.getSigner();
      }

      if (!this.signer) {
        throw new Error('Brak połączenia z portfelem. Najpierw połącz MetaMask.');
      }

      console.log('[WalletService] Oczekiwanie na podpis wiadomości...');
      const signature = await this.withTimeout(
        this.signer.signMessage(message),
        30000 // 30 sekund na podpis
      );
      
      return signature;
    } catch (error) {
      const errorMessage = this.getReadableError(error, 'Błąd podpisywania wiadomości');
      this.updateState({ error: errorMessage });
      throw new Error(errorMessage);
    }
  }

  /**
   * Pobierz klucz publiczny eip-1024
   */
  async getEncryptionPublicKey(address: string): Promise<string> {
    try {
      console.log('[WalletService] Oczekiwanie na publiczny klucz szyfrowania...');
      const key = await this.withTimeout(
        window.ethereum.request({
          method: 'eth_getEncryptionPublicKey',
          params: [address],
        }),
        30000
      );
      return key as string;
    } catch (error) {
      const errorMessage = this.getReadableError(error, 'Błąd pobierania klucza publicznego');
      throw new Error(errorMessage);
    }
  }

  /**
   * Odszyfruj klucz za pomocą eip-1024
   */
  async decryptEncryptionKey(encryptedDataHex: string, address: string): Promise<string> {
    try {
      console.log('[WalletService] Oczekiwanie na odszyfrowanie wiadomości przez MetaMask...');
      const decrypted = await this.withTimeout(
        window.ethereum.request({
          method: 'eth_decrypt',
          params: [encryptedDataHex, address],
        }),
        30000
      );
      return decrypted as string;
    } catch (error) {
      const errorMessage = this.getReadableError(error, 'Błąd podczas odszyfrowania pliku przez portfel');
      throw new Error(errorMessage);
    }
  }

  /**
   * Pobierz aktualny signer
   */
  async getSigner(): Promise<ethers.Signer | null> {
    if (this.signer) return this.signer;
    if (this.provider) {
      try {
        // Unikamy blokady jeśli provider nie odpowiada szybko
        this.signer = await this.withTimeout(this.provider.getSigner(), 3000);
        return this.signer;
      } catch (err) {
        console.warn('[WalletService] Nie udało się uzyskać signera w czasie:', err);
        return null;
      }
    }
    return null;
  }

  getWalletAddress(): string | null {
    return this.walletState$.value.address;
  }

  getWalletState$(): Observable<WalletState> {
    return this.walletState$.asObservable();
  }

  async disconnect(): Promise<void> {
    this.signer = null;
    this.clearStoredConnection();
    this.updateState({
      address: null,
      isConnected: false,
      chainId: null,
      error: null
    });
  }

  isConnected(): boolean {
    return this.walletState$.value.isConnected;
  }

  private setupEventListeners(): void {
    if (!this.isMetaMaskInstalled()) return;

    const ethereum = window.ethereum;

    ethereum.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        this.disconnect();
      } else {
        const address = accounts[0];
        this.storeConnectedWallet(address);
        void this.refreshConnection(address);
      }
    });

    ethereum.on('chainChanged', (chainId: string) => {
      window.location.reload();
    });

    ethereum.on('disconnect', () => {
      this.disconnect();
    });
  }

  private updateState(partial: Partial<WalletState>): void {
    const currentState = this.walletState$.value;
    this.walletState$.next({ ...currentState, ...partial });
  }

  async restoreConnection(): Promise<boolean> {
    if (!this.provider || !window.ethereum) return false;

    const storedWallet = this.getStoredConnectedWallet();
    if (!storedWallet) return false;

    try {
      // eth_accounts jest nie-interaktywne, powinno być szybkie
      const accounts = await this.withTimeout(
        window.ethereum.request({ method: 'eth_accounts' }),
        2000
      );

      if (!Array.isArray(accounts) || accounts.length === 0) {
        this.clearStoredConnection();
        return false;
      }

      const matchingAccount = accounts.find(
        (acc: string) => acc.toLowerCase() === storedWallet.toLowerCase()
      );

      if (!matchingAccount) {
        this.clearStoredConnection();
        return false;
      }

      await this.refreshConnection(matchingAccount);
      return true;
    } catch (error) {
      console.warn('[WalletService] Błąd odtwarzania sesji:', error);
      return false;
    }
  }

  private async refreshConnection(address?: string): Promise<void> {
    if (!this.provider) return;

    try {
      const signer = await this.withTimeout(this.provider.getSigner(), 2000);
      const network = await this.withTimeout(this.provider.getNetwork(), 2000);
      const signerAddress = address ?? (await signer.getAddress());

      this.signer = signer;
      this.updateState({
        address: signerAddress,
        isConnected: true,
        chainId: Number(network.chainId),
        error: null
      });
      this.storeConnectedWallet(signerAddress);
    } catch (err) {
      console.warn('[WalletService] Błąd odświeżania połączenia:', err);
    }
  }

  private getReadableError(error: any, fallback: string): string {
    if (!error) return fallback;

    // Przechwyć timeout
    if (error.message && error.message.includes('Przekroczono czas')) {
      return error.message;
    }

    if (typeof error === 'object') {
      const code = error.code || (error.info && error.info.error && error.info.error.code);
      if (code === 4001 || code === -32603) {
        return 'Akcja została przerwana w portfelu lub portfel jest zablokowany.';
      }
      if (code === -32002) {
        return 'MetaMask ma już aktywne żądanie. Sprawdź ikonę lisa w przeglądarce.';
      }
    }

    return error.message || fallback;
  }

  private storeConnectedWallet(address: string): void {
    localStorage.setItem(this.CONNECTED_WALLET_KEY, address);
  }

  private getStoredConnectedWallet(): string | null {
    return localStorage.getItem(this.CONNECTED_WALLET_KEY);
  }

  private clearStoredConnection(): void {
    localStorage.removeItem(this.CONNECTED_WALLET_KEY);
  }
}
