/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontSize: {
        /** 좁은 화면에서 줄바꿈·깨짐 완화 — vw로 뷰포트에 맞춤 */
        'fluid-2xs': ['clamp(0.625rem, 0.34rem + 0.75vw, 0.6875rem)', { lineHeight: '1.2' }],
        'fluid-xs': ['clamp(0.6875rem, 0.4rem + 0.9vw, 0.75rem)', { lineHeight: '1.25' }],
        'fluid-sm': ['clamp(0.75rem, 0.45rem + 1.1vw, 0.875rem)', { lineHeight: '1.35' }],
        'fluid-base': ['clamp(0.875rem, 0.55rem + 1.2vw, 1rem)', { lineHeight: '1.45' }],
        'fluid-lg': ['clamp(1.0625rem, 0.78rem + 1vw, 1.25rem)', { lineHeight: '1.35' }],
        'fluid-xl': ['clamp(1.125rem, 0.85rem + 1.25vw, 1.5rem)', { lineHeight: '1.35' }],
        'fluid-2xl': ['clamp(1.25rem, 0.95rem + 1.5vw, 1.625rem)', { lineHeight: '1.25' }],
        /** 7열 그리드 캘린더 — 창이 좁아질 때 vw만으로는 부족해 vmin으로 가로·세로 동시 반응 */
        'calendar-2xs': ['clamp(0.5rem, 0.12rem + 2.4vmin, 0.6875rem)', { lineHeight: '1.15' }],
        'calendar-xs': ['clamp(0.5625rem, 0.22rem + 2.9vmin, 0.75rem)', { lineHeight: '1.2' }],
      },
      keyframes: {
        loginTitleShimmer: {
          '0%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        loginMistDrift: {
          '0%, 100%': { transform: 'translateX(-10%) scale(1)' },
          '50%': { transform: 'translateX(10%) scale(1.1)' },
        },
        loginSublineShine: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'login-title-shimmer': 'loginTitleShimmer 5.5s linear infinite',
        'login-mist-drift': 'loginMistDrift 12s ease-in-out infinite',
        'login-subline-shine': 'loginSublineShine 4.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

