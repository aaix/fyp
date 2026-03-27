import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import * as httpProxy from 'http-proxy-3'

function dynamicGatewayProxyPlugin() {
  const gatewayProxy = httpProxy.createProxyServer({ ws: true, changeOrigin: true })

  gatewayProxy.on('error', (err, req, socket) => {
    console.error('[vite-gateway-proxy] ws error', req?.url, err.message)
    if (socket && !socket.destroyed) {
      socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n')
    }
  })

  return {
    name: 'dynamic-gateway-ws-proxy',
    configureServer(server) {
      server.httpServer?.on('upgrade', (req, socket, head) => {
        const rawUrl = req.url ?? ''
        if (!rawUrl.startsWith('/gateway')) {
          return
        }

        const parsed = new URL(rawUrl, 'http://localhost')
        const gatewayHost = parsed.searchParams.get('g')
        const target = gatewayHost ? `ws://${gatewayHost}:80` : 'ws://127.0.0.1:8001'

        req.url = parsed.pathname
        gatewayProxy.ws(req, socket, head, { target })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), dynamicGatewayProxyPlugin()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
    },
  },
})
