import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('public/templates')
const formats = ['story', 'post', 'carousel']
const catalog = []
const catalogIds = new Set()
for (const format of formats) {
  const base = path.join(root, format)
  const packages = await fs.readdir(base, { withFileTypes: true }).catch(() => [])
  for (const pkg of packages.filter((entry) => entry.isDirectory())) {
    const dir = path.join(base, pkg.name)
    for (const filename of (await fs.readdir(dir)).filter((name) => name.endsWith('.json'))) {
      const spec = JSON.parse(await fs.readFile(path.join(dir, filename), 'utf8'))
      const templateId = spec.templateId ?? path.basename(filename, '.json')
      const baseId = `${format}:${pkg.name}:${templateId}`
      const id = catalogIds.has(baseId)
        ? `${baseId}:${path.basename(filename, '.json')}`
        : baseId
      catalogIds.add(id)
      catalog.push({
        id,
        templateId,
        name: spec.displayName ?? spec.templateName ?? path.basename(filename, '.json'),
        format,
        packageId: spec.packageId ?? pkg.name,
        aspectRatio: spec.aspectRatio ?? `${spec.dimensions?.width ?? 1080}:${spec.dimensions?.height ?? 1350}`,
        width: spec.dimensions?.width ?? 1080,
        height: spec.dimensions?.height ?? (format === 'story' ? 1920 : 1350),
        path: `/templates/${format}/${pkg.name}/${filename}`,
        slideType: spec.carouselSlideType,
        status: 'published',
        version: 1,
      })
    }
  }
}
await fs.writeFile(path.join(root, 'catalog.json'), JSON.stringify(catalog, null, 2))
console.log(`Catálogo gerado: ${catalog.length} templates`)
