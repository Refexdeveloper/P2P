import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import archiver from 'archiver'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const distPath = path.resolve(__dirname, '../dist')
const packageJsonPath = path.resolve(__dirname, '../package.json')
const { name: packageName } = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

const ROOT_PAGE_COMPONENTS = [
  'ProjectDashboardPage',
  'ProjectsManagementPage',
  'TasksProject',
  'ReportsProject',
  'HelpProject',
  'EmployeeDashboardProject',
]

function zipBaseNameFromApp() {
  const appPath = path.resolve(__dirname, '../src/App.jsx')
  if (!fs.existsSync(appPath)) return packageName

  let src = fs.readFileSync(appPath, 'utf8')
  src = src.replace(/\/\*[\s\S]*?\*\//g, '')
  src = src.replace(/\/\/.*$/gm, '')

  const names = [...ROOT_PAGE_COMPONENTS].sort((a, b) => b.length - a.length)
  const re = new RegExp(`<(${names.join('|')})(?:\\s[^>]*)?\\s*/>`)
  const match = src.match(re)
  if (match) return match[1]
  return packageName
}

const zipBase = zipBaseNameFromApp()
const zipFilePath = path.resolve(__dirname, `../${zipBase}.zip`)

if (fs.existsSync(zipFilePath)) fs.unlinkSync(zipFilePath)
if (fs.existsSync(distPath)) fs.rmSync(distPath, { recursive: true, force: true })

function buildProject() {
  const isReportsZip = zipBase === 'ReportsProject'
  execSync('npx vite build', {
    stdio: 'inherit',
    env: {
      ...process.env,
      ZIP_BUILD: '1',
      KF_MANIFEST_CATEGORY: isReportsZip ? 'Page' : 'Component',
    },
  })
}

async function zipDistFolder() {
  const output = fs.createWriteStream(zipFilePath)
  const archive = archiver('zip', { zlib: { level: 9 } })

  archive.on('error', (err) => {
    throw err
  })

  archive.pipe(output)
  archive.glob('**/*', {
    cwd: distPath,
    ignore: ['**/*.map'],
  })
  await archive.finalize()
}

console.log(`zip: output -> ${path.basename(zipFilePath)}`)
buildProject()
await zipDistFolder()
