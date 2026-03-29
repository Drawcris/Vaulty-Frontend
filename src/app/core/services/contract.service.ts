import { Injectable } from '@angular/core';
import { ethers } from 'ethers';
import { WalletService } from './wallet.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class ContractService {
  // Adres kontraktu z wdrożenia lokalnego Hardhat
  private readonly contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

  // Uproszczone ABI (tylko funkcje, których potrzebujemy)
  private readonly contractABI = [
    'function fileOwners(uint256 fileId) external view returns (address)',
    'function registerFile(uint256 fileId, string memory cid) external',
    'function grantAccess(uint256 fileId, address user, uint256 expiration) external',
    'function revokeAccess(uint256 fileId, address user) external',
    'function hasAccess(uint256 fileId, address user) external view returns (bool)'
  ];

  constructor(
    private walletService: WalletService,
    private notificationService: NotificationService
  ) {}

  /**
   * Zwraca instancję kontraktu z podpiętym signerem.
   */
  async getContract(): Promise<ethers.Contract | null> {
    try {
      if (!this.walletService.isConnected()) {
        await this.walletService.connectWallet();
      }

      const signer = await this.walletService.getSigner();
      if (!signer) {
        throw new Error('Nie udało się uzyskać signera. Połącz portfel.');
      }

      return new ethers.Contract(this.contractAddress, this.contractABI, signer);
    } catch (error: any) {
      console.error('[ContractService] Błąd inicjalizacji kontraktu:', error);
      this.notificationService.error('Błąd połączenia z kontraktem: ' + error.message);
      return null;
    }
  }

  /**
   * Pomocnicza metoda do mapowania ID na przestrzeń nazw blockchain (żeby uniknąć kolizji plików i folderów).
   */
  getOnChainId(id: number, isFolder: boolean): string {
    const offset = isFolder ? 1_000_000_000 : 0;
    return (id + offset).toString();
  }

  /**
   * Rejestruje plik/folder na blockchainie. Musi być wywołane przed nadaniem dostępu.
   */
  async registerResource(id: number, isFolder: boolean, cid: string = ''): Promise<boolean> {
    try {
      const contract = await this.getContract();
      if (!contract) return false;

      const onChainId = this.getOnChainId(id, isFolder);
      
      // Sprawdź czy już zarejestrowany
      const currentOwner = await contract['fileOwners'](onChainId);
      if (currentOwner !== '0x0000000000000000000000000000000000000000') {
        return true; // Już zarejestrowany
      }

      this.notificationService.success(`Oczekiwanie na rejestrację ${isFolder ? 'folderu' : 'pliku'} on-chain...`);
      
      const tx = await contract['registerFile'](onChainId, cid);
      await tx.wait();
      
      this.notificationService.success(`${isFolder ? 'Folder' : 'Plik'} zarejestrowany on-chain.`);
      return true;
    } catch (error: any) {
      console.error('[ContractService] Błąd registerResource:', error);
      this.notificationService.error('Błąd blockchain: ' + (error.reason || error.message));
      return false;
    }
  }

  /**
   * Nadaje dostęp innemu użytkownikowi on-chain.
   */
  async grantAccess(id: number, userAddress: string, days: number, isFolder: boolean = false): Promise<boolean> {
    try {
      // Upewnij się, że zasób jest zarejestrowany
      const registered = await this.registerResource(id, isFolder);
      if (!registered) return false;

      const contract = await this.getContract();
      if (!contract) return false;

      const onChainId = this.getOnChainId(id, isFolder);
      const expiration = Math.floor(Date.now() / 1000) + (days * 24 * 60 * 60);

      this.notificationService.success('Oczekiwanie na potwierdzenie nadania dostępu (on-chain)...');
      
      const tx = await contract['grantAccess'](onChainId, userAddress, expiration);
      await tx.wait();
      
      this.notificationService.success('Dostęp nadany pomyślnie!');
      return true;
    } catch (error: any) {
      console.error('[ContractService] Błąd grantAccess:', error);
      this.notificationService.error('Błąd blockchain: ' + (error.reason || error.message));
      return false;
    }
  }

  /**
   * Odbiera dostęp on-chain.
   */
  async revokeAccess(id: number, userAddress: string, isFolder: boolean = false): Promise<boolean> {
    try {
      const contract = await this.getContract();
      if (!contract) return false;

      const onChainId = this.getOnChainId(id, isFolder);
      this.notificationService.success('Oczekiwanie na potwierdzenie odebrania dostępu...');
      
      const tx = await contract['revokeAccess'](onChainId, userAddress);
      await tx.wait();
      
      this.notificationService.success('Dostęp został odebrany on-chain.');
      return true;
    } catch (error: any) {
      console.error('[ContractService] Błąd revokeAccess:', error);
      this.notificationService.error('Błąd blockchain: ' + (error.reason || error.message));
      return false;
    }
  }
}
