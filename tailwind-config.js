// Tailwind theme (colors + fonts) for the Admin Portal.
// Must load AFTER the Tailwind CDN script and BEFORE the page renders.

tailwind.config = {
  theme: {
    extend: {
      colors: {
        leaf: {
          DEFAULT: '#143d2c',
          dark: '#0e2b1f',
          light: '#1e5941',
        },
        primary: {
          DEFAULT: '#1f6a4e',
          foreground: '#f8faf8',
          hover: '#17543d',
        },
        sun: {
          DEFAULT: '#f59e0b',
          foreground: '#3b1d03',
          hover: '#d97706',
        },
        background: '#f7faf8',
        foreground: '#1c2822',
        card: '#ffffff',
        secondary: {
          DEFAULT: '#e8f1eb',
          foreground: '#1c4b37',
        },
        muted: {
          DEFAULT: '#edf3ef',
          foreground: '#526b5e',
        },
        border: '#dce3de',
      },
      fontFamily: {
        heading: ['"Bricolage Grotesque"', 'sans-serif'],
        sans: ['"Public Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
};
