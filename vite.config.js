import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_BACKEND_URL || 'https://globaltradeapi.blockcryp.com/v1'
  const forexChartTarget =
    env.VITE_FOREX_CHART_PROXY_TARGET || 'http://192.168.0.36:8090'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/forex-chart': {
          target: forexChartTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/forex-chart/, ''),
        },
        '/forex-chart-ws': {
          target: forexChartTarget.replace(/^http/, 'ws'),
          ws: true,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/forex-chart-ws/, ''),
        },
      },
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      },
    },
    build: {
      // Use Vite's default (esbuild) minifier – much faster than terser for CI/server builds
      minify: 'esbuild',
      sourcemap: mode === 'development',
      rollupOptions: {
        output: {
          // Let Rollup/Vite decide optimal vendor chunking instead of forcing everything into a single huge "vendor" file,
          // which slows down minification and build time.
        },
      },
    },
  }
})
