import { defineConfig } from 'vite'
import { run } from 'vite-plugin-run'

export default defineConfig({
  plugins: [
    /*run([
      {
        name: "build sw",
        run: "npx esbuild serviceWorker/sw.ts --bundle --outfile=public/sw.js".split(" "),
        pattern: ["./src"]
      }
    ])*/

  ],
  build: {
    rollupOptions: {
      input: {
        sw: './sw/sw.ts',
        main: 'index.html'
      }
    }
  }
})
