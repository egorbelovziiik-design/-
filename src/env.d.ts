/// <reference types="vite/client" />

import type { WinCodeAPI } from './api-types';

declare global {
  interface Window {
    wincode: WinCodeAPI;
  }
}

export {};
