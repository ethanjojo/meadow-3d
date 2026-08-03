// @vitest-environment node

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const temporaryBuilds: string[] = []

async function buildIndex(mode: string) {
  const outDir = await mkdtemp(join(tmpdir(), `meadow-${mode}-`))
  temporaryBuilds.push(outDir)

  await build({
    root: projectRoot,
    configFile: join(projectRoot, 'vite.config.ts'),
    mode,
    logLevel: 'silent',
    build: {
      outDir,
      emptyOutDir: true,
    },
  })

  return readFile(join(outDir, 'index.html'), 'utf8')
}

afterAll(async () => {
  await Promise.all(
    temporaryBuilds.map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

describe('GitHub Pages build', () => {
  it(
    'prefixes emitted assets with the repository path',
    async () => {
      const html = await buildIndex('github-pages')

      expect(html).toMatch(/(?:src|href)="\/meadow-3d\/assets\//)
      expect(html).not.toMatch(/(?:src|href)="\/assets\//)
    },
    15_000,
  )

  it(
    'keeps default builds rooted at the host origin',
    async () => {
      const html = await buildIndex('production')

      expect(html).toMatch(/(?:src|href)="\/assets\//)
      expect(html).not.toMatch(/(?:src|href)="\/meadow-3d\/assets\//)
    },
    15_000,
  )
})
