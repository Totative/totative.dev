import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const writeups = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/writeups' }),
  schema: z.object({ title: z.string(), description: z.string() }),
})

export const collections = { writeups }
