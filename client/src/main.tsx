import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RoutePageFallback } from './components/ui/RoutePageFallback'
import { installHardNavigateOnMenuChange } from './utils/hardNavigateOnMenuChange'
import {
  isChunkLoadError,
  reloadOnceForStaleChunk,
  scheduleClearChunkReloadGuard,
} from './utils/lazyWithRetry'

installHardNavigateOnMenuChange()

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; chunkStuck: boolean }
> {
  state: { error: Error | null; chunkStuck: boolean } = { error: null, chunkStuck: false }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
    if (!isChunkLoadError(error)) return
    if (!reloadOnceForStaleChunk()) {
      this.setState({ chunkStuck: true })
    }
  }

  render() {
    if (this.state.error) {
      const chunkError = isChunkLoadError(this.state.error)
      if (chunkError && this.state.chunkStuck) {
        return <StaleChunkFallback />
      }
      if (chunkError) {
        return (
          <div className="min-h-dvh bg-white">
            <RoutePageFallback />
          </div>
        )
      }
      return (
        <div className="min-h-screen bg-gray-50 p-6 text-gray-800 font-sans">
          <h1 className="text-lg font-semibold mb-2">화면을 불러오지 못했습니다</h1>
          <p className="text-sm text-gray-600 mb-4">
            브라우저를 새로고침하거나, 문제가 계속되면 다시 로그인해 주세요.
          </p>
          <button
            type="button"
            className="mb-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            onClick={() => {
              window.location.reload()
            }}
          >
            새로고침
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

/** 가드에 걸려 자동 reload를 못 한 청크 실패 — 스택 없이 짧은 안내만 */
function StaleChunkFallback() {
  return (
    <div className="min-h-dvh bg-white p-6 text-gray-800 font-sans">
      <h1 className="text-lg font-semibold mb-2">화면을 다시 여는 중 문제가 생겼습니다</h1>
      <p className="text-sm text-gray-600 mb-4">아래 새로고침을 누르면 현재 메뉴로 다시 이동합니다.</p>
      <button
        type="button"
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        onClick={() => {
          window.location.reload()
        }}
      >
        새로고침
      </button>
    </div>
  )
}

const appRoot = createRoot(document.getElementById('root')!)

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  if (!reloadOnceForStaleChunk()) {
    appRoot.render(<StaleChunkFallback />)
  }
})

appRoot.render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)

scheduleClearChunkReloadGuard()
