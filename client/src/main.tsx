import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CHUNK_RELOAD_SESSION_KEY, isChunkLoadError } from './utils/lazyWithRetry'

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      const chunkError = isChunkLoadError(this.state.error)
      return (
        <div className="min-h-screen bg-gray-50 p-6 text-gray-800 font-sans">
          <h1 className="text-lg font-semibold mb-2">화면을 불러오지 못했습니다</h1>
          <p className="text-sm text-gray-600 mb-4">
            {chunkError
              ? '새 버전이 배포된 뒤 예전 화면이 남아 있을 수 있습니다. 아래 새로고침을 눌러 주세요.'
              : '브라우저를 새로고침하거나, 문제가 계속되면 개발자 도구(F12) 콘솔의 오류 내용을 확인해 주세요.'}
          </p>
          {chunkError ? (
            <button
              type="button"
              className="mb-4 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              onClick={() => {
                sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY)
                window.location.reload()
              }}
            >
              새로고침
            </button>
          ) : null}
          <pre className="text-xs bg-white border border-gray-200 rounded p-3 overflow-auto max-w-2xl">
            {this.state.error.message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)

try {
  sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY)
} catch {
  /* ignore */
}
