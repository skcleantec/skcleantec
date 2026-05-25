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
        /** 왕복 sheen — linear 리셋 없이 alternate 로 부드럽게 */
        loginTitleSheen: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        },
        /** 은빛 하이라이트 — 짧은 간격으로 은은하게 반짝 */
        loginSilverSparkle: {
          '0%, 100%': { opacity: '0.3' },
          '20%': { opacity: '0.5' },
          '45%': { opacity: '0.38' },
          '70%': { opacity: '0.58' },
        },
        loginMistDrift: {
          '0%, 100%': { transform: 'translate(-50%, -50%) translateX(-6%) scale(1)' },
          '50%': { transform: 'translate(-50%, -50%) translateX(6%) scale(1.06)' },
        },
        loginSublineShine: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '1' },
        },
        loginLineGrow: {
          '0%, 100%': { transform: 'scaleX(0.55)', opacity: '0.35' },
          '50%': { transform: 'scaleX(1)', opacity: '1' },
        },
        loginBrandGlow: {
          '0%, 100%': { opacity: '0.35', transform: 'scale(0.92)' },
          '50%': { opacity: '0.7', transform: 'scale(1.05)' },
        },
        loginLogoGlow: {
          '0%, 100%': { opacity: '0.45', transform: 'scale(0.96)' },
          '50%': { opacity: '0.9', transform: 'scale(1.04)' },
        },
        staffIdCardShine: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        staffIdCardVignette: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '0.85' },
        },
        honorificCertBlink: {
          '0%, 100%': { opacity: '1', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85), 0 0 0 0 rgba(180, 83, 9, 0)' },
          '50%': {
            opacity: '0.72',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.75), 0 0 10px 1px rgba(217, 119, 6, 0.22)',
          },
        },
      },
      animation: {
        'login-title-shimmer': 'loginTitleShimmer 5.5s linear infinite',
        'login-title-sheen': 'loginTitleSheen 11s ease-in-out infinite alternate',
        'login-silver-sparkle': 'loginSilverSparkle 5.5s ease-in-out infinite',
        'login-mist-drift': 'loginMistDrift 14s ease-in-out infinite',
        'login-subline-shine': 'loginSublineShine 4.5s ease-in-out infinite',
        'login-line-grow': 'loginLineGrow 5s ease-in-out infinite',
        'login-brand-glow': 'loginBrandGlow 6s ease-in-out infinite',
        'login-logo-glow': 'loginLogoGlow 7s ease-in-out infinite',
        'staff-id-shine': 'staffIdCardShine 4s ease-in-out infinite',
        'staff-id-vignette': 'staffIdCardVignette 6s ease-in-out infinite',
        'honorific-cert-blink': 'honorificCertBlink 1.45s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

