import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { visualTemplateSchema } from './templateSchema'

describe('catálogo de templates', () => {
  const catalogPath = path.resolve('public/templates/catalog.json')
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as { path: string; format: string }[]

  it('contém os 728 templates dos três pacotes', () => {
    expect(catalog).toHaveLength(728)
    expect(catalog.filter((item) => item.format === 'story')).toHaveLength(229)
    expect(catalog.filter((item) => item.format === 'post')).toHaveLength(328)
    expect(catalog.filter((item) => item.format === 'carousel')).toHaveLength(171)
  })

  it('valida todos os JSONs importados com o schema v2', () => {
    const failures: string[] = []
    for (const meta of catalog) {
      const specPath = path.resolve('public', meta.path.replace(/^\//, '').replace(/^templates\//, 'templates/'))
      const result = visualTemplateSchema.safeParse(JSON.parse(fs.readFileSync(specPath, 'utf8')))
      if (!result.success) failures.push(`${meta.path}: ${result.error.issues[0]?.message}`)
    }
    expect(failures).toEqual([])
  })

  it('rejeita IDs de camada duplicados', () => {
    const result = visualTemplateSchema.safeParse({ schemaVersion: '2.0', templateId: 'x', templateName: 'X', templateType: 'post', packageId: 'test', aspectRatio: '4:5', dimensions: { width: 1080, height: 1350 }, props: {}, layers: [{ id: 'same', type: 'text' }, { id: 'same', type: 'text' }] })
    expect(result.success).toBe(false)
  })
})
