#!/usr/bin/env node
/**
 * Baseline HTTP do WordPress local descartável (sem credenciais).
 * Não afirma p95 de produção; não é teste de carga.
 */
import { performance } from 'node:perf_hooks'
const base = process.env.PERF_BASE_URL || 'http://127.0.0.1:8099'
const endpoints = ['/', '/?rest_route=/']
const attempts = 8
const percentile = (sorted, p) => sorted[Math.ceil(sorted.length * p) - 1]
for (const path of endpoints) {
  const samples = []
  for (let i = 0; i < attempts; i++) {
    const start = performance.now()
    const response = await fetch(new URL(path, base), { redirect: 'manual', signal: AbortSignal.timeout(10000) })
    await response.arrayBuffer()
    if (response.status >= 500) throw new Error(`HTTP ${response.status} em ${path}`)
    samples.push(performance.now() - start)
  }
  samples.sort((a, b) => a - b)
  console.log(JSON.stringify({
    path, requests: attempts,
    min_ms: Math.round(samples[0]), median_ms: Math.round(percentile(samples, .5)),
    p95_ms: Math.round(percentile(samples, .95)), max_ms: Math.round(samples.at(-1)),
    environment: 'local disposable WordPress; anonymous; sequential; not production'
  }))
}
