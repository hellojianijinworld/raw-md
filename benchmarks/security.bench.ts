import { webcrypto } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { arch, availableParallelism, cpus, platform, release, totalmem } from 'node:os'
import { isAbsolute } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'
import { decryptMarkdown, encryptMarkdown } from '../src/utils/encryption'
import { generateSharePassword } from '../src/utils/password'

// Observe the real, lazily imported WASM KDF; do not replace its computation.
const kdf = vi.hoisted(() => ({ milliseconds: [] as number[] }))
vi.mock('hash-wasm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('hash-wasm')>()
  return {
    ...actual,
    argon2id: async (...args: Parameters<typeof actual.argon2id>) => {
      const start = performance.now()
      try {
        return await actual.argon2id(...args)
      } finally {
        kdf.milliseconds.push(performance.now() - start)
      }
    },
  }
})

const brotli = createRequire(import.meta.url)('brotli-wasm')
const plaintext = '# Synthetic benchmark fixture\nOwned, fixed test data.\n'.repeat(100)
const fixedHash = 'e1.AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaG5-qouGbwXzgcgTwpBZwFDipFBslqPDljNw'
const fixedPassword = 'compatibility password 🔑'
const dictionary = [
  'password',
  '123456',
  '000000000000',
  '0000000000000000000000',
  '123456789012',
  '111111111111',
  '1234567890123456789012',
  '1111111111111111111111',
  'qwerty',
  'letmein',
  'password1234',
  'correct horse battery staple',
  'raw-md',
  'benchmark',
  '37',
  '99',
] as const

type Guess = { milliseconds: number; kdfMilliseconds: number; found: boolean }
type FixtureResult = {
  id: string
  passwordCharacters: number
  candidatesAvailable: number
  attemptCap: number
  attempts: number
  failedAttempts: number
  found: boolean
  elapsedMilliseconds: number
  outcome: string
}

vi.stubGlobal('crypto', webcrypto)
afterAll(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('measures only owned synthetic fixtures and verifies fixed bounded guess outcomes', async () => {
  const reportPath = process.env.RAW_MD_SECURITY_REPORT
  if (reportPath && !isAbsolute(reportPath)) throw new Error('RAW_MD_SECURITY_REPORT must be an absolute path')
  expect(dictionary.length).toBe(16)
  expect(kdf.milliseconds).toHaveLength(0)

  const start = performance.now()
  const attempts: Guess[] = []
  async function guess(hash: string, candidate: string, expected: string) {
    if (attempts.length >= 128) throw new Error('Fixed benchmark exceeded its 128-decrypt safety cap')
    const beforeKdf = kdf.milliseconds.length
    const before = performance.now()
    let found = false
    try {
      const recovered = await decryptMarkdown(hash, brotli, candidate)
      expect(recovered).toBe(expected)
      found = true
    } catch (error) {
      if (!(error instanceof Error) || error.message !== '비밀번호가 올바르지 않거나 링크가 손상되었습니다.')
        throw error
    }
    expect(kdf.milliseconds.length - beforeKdf).toBe(1)
    const sample = { milliseconds: performance.now() - before, kdfMilliseconds: kdf.milliseconds.at(-1)!, found }
    attempts.push(sample)
    return sample
  }

  // The first decrypt includes lazy module/WASM initialization, before any fixture encryption.
  const coldFailed = await guess(fixedHash, 'benchmark-cold-wrong', 'hello')
  expect(coldFailed.found).toBe(false)
  const warmFailed = []
  const warmSuccessful = []
  for (let sample = 0; sample < 10; sample++) {
    warmFailed.push(await guess(fixedHash, `benchmark-wrong-${sample}`, 'hello'))
  }
  for (let sample = 0; sample < 10; sample++) {
    warmSuccessful.push(await guess(fixedHash, fixedPassword, 'hello'))
  }
  expect(warmFailed.every((sample) => !sample.found)).toBe(true)
  expect(warmSuccessful.every((sample) => sample.found)).toBe(true)

  // A known 16-byte test vector makes the generator fixture reproducible, not secret.
  vi.spyOn(webcrypto, 'getRandomValues').mockImplementationOnce((bytes) => {
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes?.byteLength).toBe(16)
    new Uint8Array(bytes!.buffer).set(Uint8Array.from({ length: 16 }, (_, index) => index))
    return bytes
  })
  const generatedPassword = generateSharePassword()
  vi.restoreAllMocks()
  expect(generatedPassword).toBe('AAECAwQFBgcICQoLDA0ODw')
  expect(generatedPassword).toHaveLength(22)
  expect(dictionary).not.toContain(generatedPassword)
  const randomGeneratedPassword = generateSharePassword()
  expect(randomGeneratedPassword).toHaveLength(22)
  expect(dictionary).not.toContain(randomGeneratedPassword)

  const fixtures = [
    {
      id: 'repeated-12-digits',
      password: '000000000000',
      candidates: dictionary,
      expectedAttempts: 3,
      expectedFound: true,
    },
    {
      id: 'repeated-22-digits',
      password: '0000000000000000000000',
      candidates: dictionary,
      expectedAttempts: 4,
      expectedFound: true,
    },
    {
      id: 'two-digit-exhaustive-prefix',
      password: '37',
      candidates: Array.from({ length: 64 }, (_, index) => String(index).padStart(2, '0')),
      expectedAttempts: 38,
      expectedFound: true,
    },
    {
      id: 'generator-128-bit-source-test-vector',
      password: generatedPassword,
      candidates: dictionary,
      expectedAttempts: 16,
      expectedFound: false,
    },
    {
      id: 'generator-128-bit-source-real-csprng',
      password: randomGeneratedPassword,
      candidates: dictionary,
      expectedAttempts: 16,
      expectedFound: false,
    },
  ]
  const fixtureResults: FixtureResult[] = []
  for (const fixture of fixtures) {
    expect(fixture.candidates.length).toBeLessThanOrEqual(64)
    const hash = await encryptMarkdown(plaintext, brotli, fixture.password)
    if (fixture.id.startsWith('generator-')) {
      expect((await guess(hash, fixture.password, plaintext)).found).toBe(true)
    }
    const samples = []
    for (const candidate of fixture.candidates) {
      const sample = await guess(hash, candidate, plaintext)
      samples.push(sample)
      if (sample.found) break
    }
    expect(samples).toHaveLength(fixture.expectedAttempts)
    expect(samples.at(-1)!.found).toBe(fixture.expectedFound)
    fixtureResults.push({
      id: fixture.id,
      passwordCharacters: fixture.password.length,
      candidatesAvailable: fixture.candidates.length,
      attemptCap: 64,
      attempts: samples.length,
      failedAttempts: samples.filter((sample) => !sample.found).length,
      found: samples.at(-1)!.found,
      elapsedMilliseconds: samples.reduce((sum, sample) => sum + sample.milliseconds, 0),
      outcome: fixture.expectedFound
        ? 'recovered within the fixed budget'
        : 'not recovered within the fixed 16-candidate dictionary; no general security proof',
    })
  }

  const report = buildReport({ coldFailed, warmFailed, warmSuccessful, fixtureResults, attempts, start })
  expect(report.attempts.decryptTotal).toBe(100)
  expect(report.attempts.kdfTotal).toBe(105)
  expect(report.attempts.decryptFailed).toBe(85)
  expect(report.attempts.decryptSuccessful).toBe(15)
  expect(report.models.at(-1)!.searchSpace).toBe('340282366920938463463374607431768211456')
  expect(report.models.at(-1)!.entropyBits).toBe(128)
  expect(JSON.stringify(report)).not.toContain(randomGeneratedPassword)
  console.log(JSON.stringify(report, null, 2))
  if (reportPath) await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'w' })
})

function summarize(milliseconds: number[]) {
  const sorted = [...milliseconds].sort((left, right) => left - right)
  const sum = sorted.reduce((total, value) => total + value, 0)
  return {
    samples: sorted.length,
    medianMilliseconds: (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2,
    minimumMilliseconds: sorted[0],
    maximumMilliseconds: sorted.at(-1)!,
    totalMilliseconds: sum,
    serialGuessesPerSecond: (milliseconds.length * 1000) / sum,
    milliseconds,
  }
}

function buildReport({
  coldFailed,
  warmFailed,
  warmSuccessful,
  fixtureResults,
  attempts,
  start,
}: {
  coldFailed: Guess
  warmFailed: Guess[]
  warmSuccessful: Guess[]
  fixtureResults: FixtureResult[]
  attempts: Guess[]
  start: number
}) {
  const failedDecrypt = summarize(warmFailed.map((sample) => sample.milliseconds))
  const rateScenarios = [
    { id: 'measured-local-serial-wasm', guessesPerSecond: failedDecrypt.serialGuessesPerSecond, measured: true },
    ...[1000, 1_000_000, 1_000_000_000_000].map((guessesPerSecond) => ({
      id: `hypothetical-${guessesPerSecond}-per-second`,
      guessesPerSecond,
      measured: false,
    })),
  ]
  const spaces = [
    { id: 'uniform-12-decimal-digits', characters: 12, alphabetSize: 10, space: 10n ** 12n },
    { id: 'uniform-22-decimal-digits', characters: 22, alphabetSize: 10, space: 10n ** 22n },
    { id: 'uniform-12-printable-ascii-non-space', characters: 12, alphabetSize: 94, space: 94n ** 12n },
    { id: 'uniform-22-printable-ascii-non-space', characters: 22, alphabetSize: 94, space: 94n ** 22n },
    { id: 'production-generator-16-uniform-random-bytes', characters: 22, alphabetSize: 64, space: 2n ** 128n },
  ]
  return {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    elapsedMilliseconds: performance.now() - start,
    runtime: {
      node: process.version,
      v8: process.versions.v8,
      platform: platform(),
      osRelease: release(),
      architecture: arch(),
      cpuModel: cpus()[0]?.model ?? 'unavailable',
      logicalCpuCount: cpus().length,
      availableParallelism: availableParallelism(),
      totalMemoryBytes: totalmem(),
    },
    implementation: {
      decryptPath: 'src/utils/encryption.ts decryptMarkdown, real hash-wasm Argon2id and Node WebCrypto AES-256-GCM',
      kdf: { algorithm: 'Argon2id', memoryKiB: 65536, iterations: 3, parallelism: 1, outputBytes: 32 },
      hashWasmVersion: createRequire(import.meta.url)('hash-wasm/package.json').version as string,
      compression: 'real brotli-wasm, with the production codec selection and decompression',
      kdfTiming: 'real argon2id call timed by a transparent Vitest module wrapper; no hash substitution',
      execution: 'one Node worker, serial guesses, no concurrent password guesses',
    },
    budget: { maximumDecryptCalls: 128, maximumCandidatesPerFixture: 64, warmSamplesPerOutcome: 10 },
    attempts: {
      decryptTotal: attempts.length,
      decryptFailed: attempts.filter((sample) => !sample.found).length,
      decryptSuccessful: attempts.filter((sample) => sample.found).length,
      fixtureEncryptionCalls: 5,
      generatedFixtureKnownPasswordControls: 2,
      kdfTotal: kdf.milliseconds.length,
    },
    timing: {
      coldFirstFailedDecrypt: coldFailed,
      warmFailedDecrypt: failedDecrypt,
      warmFailedKdfOnly: summarize(warmFailed.map((sample) => sample.kdfMilliseconds)),
      warmSuccessfulDecrypt: summarize(warmSuccessful.map((sample) => sample.milliseconds)),
      warmSuccessfulKdfOnly: summarize(warmSuccessful.map((sample) => sample.kdfMilliseconds)),
    },
    dictionary: [...dictionary],
    fixtures: fixtureResults,
    rateScenarios,
    models: spaces.map(({ id, characters, alphabetSize, space }) => ({
      id,
      characters,
      alphabetSize,
      searchSpace: space.toString(),
      entropyBits: Math.log2(Number(space)),
      expectedGuessesApproximate: (space / 2n).toString(),
      projectedExpectedSeconds: Object.fromEntries(
        rateScenarios.map((scenario) => [scenario.id, Number(space) / 2 / scenario.guessesPerSecond]),
      ),
    })),
    limitations: [
      'These measurements are this host’s serial Node/WASM path; they do not measure a browser, native optimized cracker, GPU, ASIC, multi-host attack, or future hardware.',
      'The hypothetical rates are arithmetic scenarios only, with no hardware capability or cost claim.',
      'Projection assumes an independently uniform secret, an offline verifier, classical guessing without replacement, and approximately N/2 guesses on average. Human-selected strings and repeated digits do not satisfy that distribution.',
      'The fixed generator fixture uses a public deterministic 16-byte test vector and therefore is not itself a 128-bit secret. The production generator’s 128-bit model assumes 16 fresh uniform CSPRNG bytes.',
      'A separate fixture uses the production generator with real Node WebCrypto CSPRNG bytes; its password is omitted from this report. It was checked with the correct password and the same 16-candidate dictionary.',
      'Failure to recover a fixture in 16 guesses proves only that none of those 16 candidates opened it. No tested length is proved uncrackable.',
      'Cold timing is one first-use sample. Warm distributions contain only 10 serial samples per outcome, and other host activity can affect them.',
      'Fresh random salts, IVs, and one CSPRNG-generated fixture password mean exact ciphertext, timings, and that password vary; plaintext, dictionary order, deterministic test vector, KDF parameters, and attempt budgets are fixed.',
    ],
  }
}
