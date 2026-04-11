import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── ORIGIN ONE DESIGN TOKENS — LOCKED ──────────────────────
      // Source of truth. Nothing gets hardcoded anywhere else.

      colors: {
        // Surfaces
        bg:       '#04040a',
        surface:  '#0a0a12',
        surface2: '#0f0f1a',
        surface3: '#141420',

        // Text
        text:  '#dddde8',
        text2: '#a0a0b8',
        muted: '#62627a',

        // Accent
        accent: {
          DEFAULT: '#6470f3',
          soft:    '#7880f5',
          dim:     'rgba(100,112,243,0.13)',
        },

        // Phase — LOCKED SYSTEM-WIDE
        pre: {
          DEFAULT: '#e8a020',
          dim:     'rgba(232,160,32,0.13)',
          glow:    'rgba(232,160,32,0.35)',
        },
        prod: {
          DEFAULT: '#6470f3',
          dim:     'rgba(100,112,243,0.13)',
          glow:    'rgba(100,112,243,0.35)',
        },
        post: {
          DEFAULT: '#00b894',
          dim:     'rgba(0,184,148,0.13)',
          glow:    'rgba(0,184,148,0.35)',
        },

        // Utility
        green: '#00c896',
        amber: '#f0a030',
        red:   '#e04040',

        // Borders
        border:  'rgba(255,255,255,0.05)',
        border2: 'rgba(255,255,255,0.09)',
        border3: 'rgba(255,255,255,0.14)',
      },

      // Typography — Manrope + DM Mono (loaded via next/font)
      fontFamily: {
        sans: ['var(--font-manrope)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'SF Mono', 'ui-monospace', 'monospace'],
      },

      // Type scale
      fontSize: {
        'xs':   ['0.48rem', { lineHeight: '1.4' }],
        'sm':   ['0.52rem', { lineHeight: '1.4' }],
        'base': ['0.76rem', { lineHeight: '1.5' }],
        'md':   ['0.8rem',  { lineHeight: '1.5' }],
        'lg':   ['0.9rem',  { lineHeight: '1.4' }],
        'xl':   ['1.1rem',  { lineHeight: '1.3' }],
        '2xl':  ['1.4rem',  { lineHeight: '1.2' }],
      },

      // Spacing scale from spec
      spacing: {
        '0.5': '2px',
        '1':   '4px',
        '1.5': '6px',
        '2':   '8px',
        '2.5': '10px',
        '3':   '12px',
        '3.5': '13px',
        '4':   '14px', // Note: spec uses 14px as section gap
        '5':   '16px', // screen edge gutters
        '6':   '20px', // between cards
        '7':   '24px', // between sections
      },

      // Border radius from spec
      borderRadius: {
        'sm':     '4px',
        DEFAULT:  '7px',
        'md':     '8px',
        'lg':     '9px',
        'xl':     '12px',
        'sheet':  '12px',
        'full':   '9999px',
      },

      // Box shadows from spec
      boxShadow: {
        'card':        '0 2px 12px rgba(0,0,0,0.4)',
        'sheet':       '0 -4px 30px rgba(0,0,0,0.6)',
        'accent-glow': '0 0 5px #6470f3',
        'pre-glow':    '0 0 8px rgba(232,160,32,0.35)',
        'prod-glow':   '0 0 8px rgba(100,112,243,0.35)',
        'post-glow':   '0 0 8px rgba(0,184,148,0.35)',
      },

      // Animations from spec
      transitionTimingFunction: {
        'spring':   'cubic-bezier(0.32, 0.72, 0, 1)',
        'out-expo': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'ripple':   'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      transitionDuration: {
        '120': '120ms',
        '150': '150ms',
        '180': '180ms',
        '300': '300ms',
        '400': '400ms',
      },

      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(22px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        sheetUp: {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' },
        },
        ripple: {
          from: { transform: 'scale(0)', opacity: '0.4' },
          to:   { transform: 'scale(2.5)', opacity: '0' },
        },
        expandFill: {
          from: { transform: 'scale(1)', borderRadius: '9px', opacity: '1' },
          to:   { transform: 'scale(20)', borderRadius: '0px', opacity: '0' },
        },
        staggerIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },

      animation: {
        'fade-up':      'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'slide-up':     'slideUp 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'slide-in':     'slideIn 0.25s ease both',
        'sheet-up':     'sheetUp 0.3s cubic-bezier(0.32,0.72,0,1) both',
        'ripple':       'ripple 0.4s cubic-bezier(0.4,0,0.2,1) forwards',
        'expand-fill':  'expandFill 0.4s cubic-bezier(0.22,1,0.36,1) forwards',
        'stagger-in':   'staggerIn 0.18s ease both',
        'spin-slow':    'spin 1s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
