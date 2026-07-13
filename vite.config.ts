import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base: './'` makes the built asset URLs relative. This is REQUIRED: inside
// GameStateTracker the site is served from /companion-sites/<id>/, not the
// server root, so absolute `/assets/...` paths would 404. Relative paths work
// both there and when the built `dist/` is opened standalone.
export default defineConfig({
  plugins: [react()],
  base: './',
})
