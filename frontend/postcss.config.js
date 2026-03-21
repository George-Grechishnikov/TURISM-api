import autoprefixer from 'autoprefixer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from 'tailwindcss'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Явный путь к конфигу — надёжнее при запуске из другой cwd и длинных путях (OneDrive и т.д.). */
export default {
  plugins: [
    tailwindcss({ config: path.join(__dirname, 'tailwind.config.js') }),
    autoprefixer(),
  ],
}
