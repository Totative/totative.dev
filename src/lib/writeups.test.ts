// @ts-expect-error bun:test is untyped in this tsconfig
import { mock } from 'bun:test'

interface Entry {
  id: string
  filePath?: string
  body?: string
}

let fixtures: Entry[] = []

mock.module('astro:content', () => ({
  getCollection: () => fixtures,
}))

const { getWriteups, writeupPaths } = await import('./writeups.ts')

const entries = (value: Entry[]): void => {
  fixtures = value
}

const words = (count: number): string => Array.from({ length: count }, () => 'w').join(' ')

const success: Array<{
  files: Entry[]
  want: Array<{ slug: string; date: string; minutes: number }>
}> = [
  {
    files: [{ id: 'a', filePath: '2024-12-01-hello.md', body: '' }],
    want: [{ slug: 'hello', date: '2024-12-01', minutes: 1 }],
  },
  {
    files: [{ id: 'a', filePath: 'posts/2020-01-01-x.md' }],
    want: [{ slug: 'x', date: '2020-01-01', minutes: 1 }],
  },
  {
    files: [{ id: 'a', filePath: '/abs/2021-03-03-foo-bar.md', body: words(330) }],
    want: [{ slug: 'foo-bar', date: '2021-03-03', minutes: 2 }],
  },
  {
    files: [
      { id: 'old', filePath: '2020-01-01-old.md', body: words(1) },
      { id: 'new', filePath: '2024-06-01-new.md', body: words(220) },
      { id: 'mid', filePath: '2023-12-31-mid.md', body: words(109) },
    ],
    want: [
      { slug: 'new', date: '2024-06-01', minutes: 1 },
      { slug: 'mid', date: '2023-12-31', minutes: 1 },
      { slug: 'old', date: '2020-01-01', minutes: 1 },
    ],
  },
]

for (const { files, want } of success) {
  entries(files)
  const got = await getWriteups()
  const slim = got.map(({ slug, date, minutes }) => ({ slug, date, minutes }))
  if (JSON.stringify(slim) !== JSON.stringify(want)) {
    throw new Error(`getWriteups: got ${JSON.stringify(slim)}, want ${JSON.stringify(want)}`)
  }
  for (const writeup of got) {
    if (writeup.entry !== files.find((f) => f.id === writeup.entry.id)) {
      throw new Error(`getWriteups: entry ${writeup.slug} was not the collection object`)
    }
  }
  const paths = await writeupPaths()
  const pathSlugs = paths.map((p) => p.params.slug)
  const wantSlugs = want.map((w) => w.slug)
  if (JSON.stringify(pathSlugs) !== JSON.stringify(wantSlugs)) {
    throw new Error(
      `writeupPaths: got ${JSON.stringify(pathSlugs)}, want ${JSON.stringify(wantSlugs)}`,
    )
  }
  for (const [i, path] of paths.entries()) {
    if (path.props.writeup.slug !== want[i]?.slug || path.props.writeup.date !== want[i]?.date) {
      throw new Error(`writeupPaths props mismatch at ${i}`)
    }
  }
}

const minuteCounts = [0, 1, 109, 110, 219, 220, 329, 330, 439]
for (const count of minuteCounts) {
  entries([{ id: 'n', filePath: '2022-02-02-n.md', body: words(count) }])
  const [got] = await getWriteups()
  const want = Math.max(1, Math.round(count / 220))
  if (got?.minutes !== want) {
    throw new Error(`minutes(${count} words): got ${got?.minutes}, want ${want}`)
  }
}

const failures: Array<{ filePath?: string; id: string }> = [
  { id: 'plain', filePath: 'hello.md' },
  { id: 'missing' },
  { id: 'no-slug', filePath: '2024-01-01.md' },
  { id: 'nested', filePath: '2024-01-01-dir/x.md' },
  { id: 'empty-slug', filePath: '2024-01-01-.md' },
]

for (const row of failures) {
  const file: Entry = { id: row.id, body: 'hi' }
  if (row.filePath !== undefined) {
    file.filePath = row.filePath
  }
  entries([file])
  let threw = false
  try {
    await getWriteups()
  } catch (error) {
    threw = true
    const want = `write-up "${row.id}" is not named YYYY-MM-DD-slug.md`
    if (!(error instanceof Error) || error.message !== want) {
      throw new Error(`getWriteups throw: got ${String(error)}, want ${want}`, { cause: error })
    }
  }
  if (!threw) {
    throw new Error(`getWriteups(${row.filePath}): expected throw`)
  }
}
