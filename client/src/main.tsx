import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

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
      return (
        <div className="min-h-screen bg-gray-50 p-6 text-gray-800 font-sans">
          <h1 className="text-lg font-semibold mb-2">화면을 불러오지 못했습니다</h1>
          <p className="text-sm text-gray-600 mb-4">
            브라우저를 새로고침하거나, 문제가 계속되면 개발자 도구(F12) 콘솔의 오류 내용을 확인해 주세요.
          </p>
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
