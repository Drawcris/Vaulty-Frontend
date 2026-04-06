import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { Buffer } from 'buffer';
import { EventEmitter } from 'events';
import * as process from 'process';

const win = window as any;
win.global = win;
win.Buffer = win.Buffer || Buffer;
win.process = win.process || process;
win.EventEmitter = win.EventEmitter || EventEmitter;

import { App } from './app/app';
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
