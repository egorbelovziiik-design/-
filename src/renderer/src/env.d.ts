/// <reference types="vite/client" />
import type { WinCodeApi } from '../../preload'

declare global {
  interface Window { api: WinCodeApi }
}
declare module '*.css'
