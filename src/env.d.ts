/// <reference types="vite/client" />

interface BitrixResult<T = unknown> {
  data(): T
  error(): string | null
  error_description(): string
  total?(): number
}

interface BitrixPlacementInfo {
  placement?: string
  options?: Record<string, unknown>
}

interface BitrixSdk {
  init(callback: () => void): void
  callMethod<T = unknown>(method: string, params: Record<string, unknown>, callback: (result: BitrixResult<T>) => void): void
  placement?: { info(): BitrixPlacementInfo }
  install?(callback: () => void): void
  installFinish(): void
  resizeWindow?(width: number | string, height: number | string): void
}

interface Window {
  BX24?: BitrixSdk
}
