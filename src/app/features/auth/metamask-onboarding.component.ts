import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-metamask-onboarding',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './metamask-onboarding.component.html',
  styleUrls: ['./metamask-onboarding.component.css']
})
export class MetamaskOnboardingComponent {
  constructor() {}

  /**
   * Otwórz MetaMask download page
   */
  openMetaMaskDownload(): void {
    window.open('https://metamask.io/download/', '_blank');
  }

  /**
   * Otwórz MetaMask setup tutorial
   */
  openMetaMaskTutorial(): void {
    window.open('https://support.metamask.io/hc/en-us/articles/360015289612-How-to-create-an-account', '_blank');
  }

  /**
   * Otwórz Ethereum/Web3 guide
   */
  openWeb3Guide(): void {
    window.open('https://ethereum.org/en/what-is-ethereum/', '_blank');
  }

  /**
   * Reload page gdy MetaMask jest już zainstalowany
   */
  reloadPage(): void {
    window.location.reload();
  }

  /**
   * Przenieś do strony głównej
   */
  goHome(): void {
    window.location.href = '/';
  }
}

