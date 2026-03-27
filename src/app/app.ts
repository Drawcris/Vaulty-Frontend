import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import {
  animate,
  group,
  query,
  style,
  transition,
  trigger
} from '@angular/animations';
import { RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from './core/services/auth.service';
import { environment } from './config/environment';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, MatProgressSpinnerModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  animations: [
    trigger('routeTransition', [
      transition('* <=> *', [
        style({ position: 'relative' }),
        query(
          ':enter, :leave',
          [
            style({
              position: 'absolute',
              inset: 0,
              width: '100%'
            })
          ],
          { optional: true }
        ),
        group([
          query(
            ':leave',
            [
              style({
                opacity: 1,
                transform: 'translateY(0) scale(1)',
                filter: 'blur(0px)'
              }),
              animate(
                '1000ms cubic-bezier(0.22, 1, 0.36, 1)',
                style({
                  opacity: 0,
                  transform: 'translateY(-18px) scale(1.01)',
                  filter: 'blur(10px)'
                })
              )
            ],
            { optional: true }
          ),
          query(
            ':enter',
            [
              style({
                opacity: 0,
                transform: 'translateY(28px) scale(0.985)',
                filter: 'blur(10px)'
              }),
              animate(
                '1000ms cubic-bezier(0.22, 1, 0.36, 1)',
                style({
                  opacity: 1,
                  transform: 'translateY(0) scale(1)',
                  filter: 'blur(0px)'
                })
              )
            ],
            { optional: true }
          )
        ])
      ])
    ])
  ]
})
export class App {
  protected readonly title = signal('Frontend');
  protected readonly appVersion = signal(environment.APP_VERSION);
  protected readonly isBootstrapping$: Observable<boolean>;
  protected readonly isAuthenticated$: Observable<boolean>;

  constructor(private authService: AuthService) {
    this.isBootstrapping$ = this.authService.getAuthState$().pipe(
      map(state => state.bootstrapping),
      distinctUntilChanged()
    );

    this.isAuthenticated$ = this.authService.getAuthState$().pipe(
      map(state => state.isAuthenticated),
      distinctUntilChanged()
    );
  }

  protected prepareRoute(outlet: RouterOutlet): string {
    if (!outlet?.isActivated) {
      return 'initial';
    }

    return outlet.activatedRoute.routeConfig?.path ?? 'unknown';
  }
}
