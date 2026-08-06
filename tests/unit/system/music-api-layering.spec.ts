import path from 'node:path'
import { readFileSync } from 'node:fs'

describe('music v1 API layering', () => {
  it('keeps musicV1.ts as a compatibility facade', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/api/musicV1.ts'), 'utf8')

    expect(source.trim().split('\n')).toEqual([
      "export * from './musicV1/types'",
      "export { musicV1Endpoints } from './musicV1/core'",
      "export * from './musicV1/imports'",
      "export * from './musicV1/catalog'",
    ])
  })

  it('keeps resource modules dependent only on lower-level modules', () => {
    const expectedDependencies = {
      types: [],
      core: ['types'],
      imports: ['core', 'types'],
      catalog: ['core', 'types'],
    }

    for (const [module, expected] of Object.entries(expectedDependencies)) {
      const source = readFileSync(path.resolve(process.cwd(), `src/api/musicV1/${module}.ts`), 'utf8')
      const dependencies = [...source.matchAll(/from ['"]\.\/([^'"]+)['"]/g)]
        .map((match) => match[1])
        .filter((dependency) => dependency !== module)

      expect([...new Set(dependencies)].sort()).toEqual(expected)
      expect(source).not.toMatch(/from ['"](?:@\/api\/musicV1|\.\.\/musicV1)['"]/)
    }
  })
})
