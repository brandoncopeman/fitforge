import sharp from "sharp"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const normalSource = path.join(__dirname, "../public/icons/fitforge-icon-normal.png")
const maskableSource = path.join(__dirname, "../public/icons/fitforge-icon-maskable.png")
const outputDir = path.join(__dirname, "../public/icons")

async function makeIcon(source, filename, size) {
  await sharp(source)
    .resize(size, size, {
      fit: "cover",
    })
    .png()
    .toFile(path.join(outputDir, filename))

  console.log(`Created ${filename}`)
}

async function main() {
  await makeIcon(normalSource, "icon-192.png", 192)
  await makeIcon(normalSource, "icon-512.png", 512)
  await makeIcon(maskableSource, "icon-maskable-192.png", 192)
  await makeIcon(maskableSource, "icon-maskable-512.png", 512)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})