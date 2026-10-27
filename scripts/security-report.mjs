import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const YEAR = 365.25 * 86400

export function averageGuessSeconds(space, rate) {
  if (space < 1n || !Number.isFinite(rate) || rate <= 0) throw new Error('Positive search space and rate required')
  return Number(space) / 2 / rate
}

export function minimumRandomLength(alphabet, bits) {
  if (alphabet < 2 || !Number.isInteger(alphabet) || !Number.isFinite(bits) || bits <= 0)
    throw new Error('Invalid random model')
  return Math.ceil(bits / Math.log2(alphabet))
}

export function minimumRandomLengthForYears(alphabet, rate, years) {
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(years) || years <= 0)
    throw new Error('Invalid time model')
  return minimumRandomLength(alphabet, Math.log2(2 * rate * years * YEAR))
}

function duration(seconds) {
  if (seconds < 1) return `${Number(seconds.toPrecision(3))}초`
  if (seconds < 60) return `${seconds.toFixed(2)}초`
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}분`
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}시간`
  if (seconds < YEAR) return `${(seconds / 86400).toFixed(1)}일`
  const years = seconds / YEAR
  return years < 1e6
    ? `${years.toLocaleString('en-US', { maximumFractionDigits: 1 })}년`
    : `${years.toExponential(2)}년`
}

const escapeHtml = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const table = (head, rows) =>
  `<div class="table-scroll"><table><thead><tr>${head.map((s) => `<th>${escapeHtml(s)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((s) => `<td>${escapeHtml(s)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`

async function main() {
  const [input, output] = process.argv.slice(2)
  if (!input || !output) throw new Error('Usage: node scripts/security-report.mjs <benchmark.json> <report.html>')
  const data = JSON.parse(await readFile(input, 'utf8'))
  if (data.schemaVersion !== 1 || !(data.timing?.warmFailedDecrypt?.serialGuessesPerSecond > 0))
    throw new Error('Invalid benchmark report')
  const measuredRate = data.timing.warmFailedDecrypt.serialGuessesPerSecond
  const rates = [measuredRate, 1e3, 1e6, 1e12]
  const models = [
    ['숫자 무작위 8자리', 10n ** 8n],
    ['숫자 무작위 12자리', 10n ** 12n],
    ['숫자 무작위 22자리', 10n ** 22n],
    ['영문 대소문자·숫자 무작위 12자', 62n ** 12n],
    ['영문 대소문자·숫자 무작위 16자', 62n ** 16n],
    ['영문 대소문자·숫자·기호 무작위 12자', 94n ** 12n],
    ['중요 보안: 자동 생성 22자', 2n ** 128n],
  ]
  const estimates = models.map(([label, space]) => ({
    label,
    searchSpace: String(space),
    bits: Math.log2(Number(space)),
    seconds: rates.map((rate) => averageGuessSeconds(space, rate)),
  }))
  const timeTable = table(
    [
      '균등한 무작위 생성 기준',
      '엔트로피',
      `실측 ${measuredRate.toFixed(2)}회/초`,
      '가정 1천 회/초',
      '가정 100만 회/초',
      '가정 1조 회/초',
    ],
    estimates.map((row) => [row.label, `${row.bits.toFixed(1)}비트`, ...row.seconds.map(duration)]),
  )
  const alphabetRows = [
    ['숫자', 10],
    ['영문 소문자', 26],
    ['영문 대소문자·숫자', 62],
    ['영문 대소문자·숫자·기호', 94],
    ['Base64url 전체 문자', 64],
  ]
  const thresholds = table(
    ['매 글자를 독립·균등하게 생성할 때', '가정 1조 회/초에서 평균 100년 이상', '128비트 이상 확보'],
    alphabetRows.map(([name, size]) => [
      name,
      `${minimumRandomLengthForYears(size, 1e12, 100)}자`,
      `${minimumRandomLength(size, 128)}자`,
    ]),
  )
  const fixtureLabels = {
    'repeated-12-digits': '0을 반복한 12자',
    'repeated-22-digits': '0을 반복한 22자',
    'two-digit-exhaustive-prefix': '숫자 2자리: 37 (00부터 순차 대입)',
    'generator-128-bit-source-test-vector': '22자 공개 테스트 벡터',
    'generator-128-bit-source-real-csprng': '실제 CSPRNG 자동 생성 22자',
  }
  const fixtureTable = table(
    ['실제 앱 암호화로 만든 합성 문서', '시도 횟수', '소요 시간', '결과'],
    data.fixtures.map((fixture) => [
      fixtureLabels[fixture.id] ?? fixture.id,
      fixture.attempts,
      duration(fixture.elapsedMilliseconds / 1000),
      fixture.found ? '이 후보 범위에서 복원 성공' : '16개 후보에서 미발견; 올바른 비밀번호 복원 확인',
    ]),
  )
  const measuredAt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(data.measuredAt))
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>raw-md 암호화 공격 비용 검증</title>
<style>body{margin:0;background:#10141a;color:#e6edf3;font:15px/1.7 system-ui,sans-serif}main{max-width:1180px;margin:auto;padding:40px 24px 80px}h1{font-size:30px;letter-spacing:-1px}h2{margin-top:40px;font-size:22px}p,li{color:#b7c0cc}strong{color:#fff}a{color:#89baff}.card{padding:20px 24px;background:#18202b;border:1px solid #354254;border-radius:14px;margin:20px 0}.table-scroll{overflow:auto;border:1px solid #354254;border-radius:12px;margin:16px 0}table{width:100%;border-collapse:collapse;text-align:left;white-space:nowrap}th,td{padding:12px 14px;border-bottom:1px solid #2a3442;font-variant-numeric:tabular-nums}th{background:#1c2735;font-size:13px}td:first-child{white-space:normal;min-width:170px}tr:last-child td{border:0}small{color:#9aa8ba}.tag{display:inline-block;border:1px solid #46617e;padding:3px 10px;border-radius:20px;font-size:12px}</style>
<main><span class="tag">raw-md · 실측과 이론 계산</span><h1>몇 글자면 비밀번호를 못 풀까?</h1><div class="card"><strong>모든 비밀번호에 적용되는 길이 기준은 없습니다.</strong><p>실험에서 22자 반복 비밀번호도 4번의 추측으로 복원됐습니다. 자동 설정은 길이가 아니라, 16바이트의 새로운 암호학적 난수에서 나오는 <strong>128비트 후보 공간</strong>을 사용합니다.</p></div>
<h2>제공하는 세 가지 공유 방식</h2>${table(
    ['방식', '동작', '보안 기준'],
    [
      ['그냥 공유', '비밀번호 없이 압축 링크 공유', '링크 소유자가 문서를 볼 수 있음'],
      ['직접 설정', '사용자가 정한 비밀번호로 암호화', '사람이 정한 문장·반복 패턴의 엔트로피는 길이로 확정 불가'],
      ['중요 보안 (자동 설정)', '22자 비밀번호를 자동 생성', '128비트 난수 + Argon2id + AES-256-GCM'],
    ],
  )}
<h2>1. 실제로 대입해서 확인한 결과</h2><p>${escapeHtml(data.runtime.cpuModel)}, ${data.runtime.architecture}, Node ${escapeHtml(data.runtime.node)}. Argon2id 64MiB·3회·병렬도 1, AES-256-GCM. 한 Node/WASM 실행 흐름에서 순차 측정했습니다.</p><p>실패한 전체 복호화 시도 중앙값 <strong>${data.timing.warmFailedDecrypt.medianMilliseconds.toFixed(1)}ms</strong>; 10회 총 시간 기준 <strong>초당 ${measuredRate.toFixed(2)}회</strong>. KDF만 측정한 중앙값 ${data.timing.warmFailedKdfOnly.medianMilliseconds.toFixed(1)}ms. GPU, 최적화된 네이티브 크래커, 여러 컴퓨터는 측정하지 않았습니다.</p>${fixtureTable}<p>자동 생성 22자에서 16개 후보가 실패한 것은 해당 후보에 대한 관찰입니다. 풀 수 없다는 증명이 아닙니다. 공개 테스트 벡터는 인코딩 재현용이며 비밀 난수가 아닙니다. 별도의 실제 CSPRNG 생성 비밀번호도 같은 후보와 정답 복원 대조군으로 검증했습니다.</p>
<h2>2. 컴퓨팅 파워별 평균 탐색 시간</h2><p><strong>평균 시간 ≈ 후보 수 ÷ 2 ÷ 초당 검증 횟수.</strong> 매 비밀번호가 후보 공간에서 균등하게 뽑혔고, 공격자가 중복 없이 고전적 전수 탐색을 한다고 가정합니다. 사람의 문장과 반복 문자에는 적용하지 않습니다.</p>${timeTable}<div class="card"><strong>가정 속도는 하드웨어 벤치마크가 아닙니다.</strong><p>1천·100만·1조 회/초는 공격자가 Argon2id를 포함한 비밀번호 검증 전체를 그 속도로 수행한다고 놓은 계산 시나리오입니다. 특정 GPU 한 대나 실제 장비 가격·전력에 대응시키지 않습니다. 평균 시간이며 성공 시점의 보장 하한도 아닙니다.</p></div>
<h2>3. 길이별 기준을 정한다면</h2><p>아래 첫 기준은 비교를 위해 정한 <strong>초당 1조 회, 평균 100년</strong>이라는 임의의 목표입니다. ‘이 길이면 못 푼다’는 의미가 아닙니다. 두 번째는 128비트 후보 공간을 확보하는 계산상 길이입니다.</p>${thresholds}<p>‘중요 보안’의 22자는 16바이트를 Base64url로 표현한 것이므로 정확히 128비트입니다. 22글자 각각이 독립인 132비트로 과대평가하지 않습니다. 직접 설정에서 흔한 표현·이름·날짜·반복 패턴을 쓰면 위 표보다 훨씬 빨리 추측될 수 있습니다.</p>
<h2>측정의 범위</h2><ul><li>복호화 ${data.attempts.decryptTotal}회, 암호화 ${data.attempts.fixtureEncryptionCalls}회, 실제 KDF ${data.attempts.kdfTotal}회. 총 측정 시간 ${(data.elapsedMilliseconds / 1000).toFixed(2)}초.</li><li>실측은 이 기기의 짧은 단일 실행 표본입니다. 동시 작업, 온도, 구현과 장치에 따라 달라집니다.</li><li>서버 없이 URL로 복원하므로 공격자의 오프라인 시도 횟수를 제한할 수 없습니다.</li><li>비밀번호 유출, 단말 침해, 미래의 알고리즘 취약점은 이 시간 계산의 범위 밖입니다. 암호문 길이에서 압축 크기는 드러납니다.</li></ul>
<p>근거: <a href="https://www.rfc-editor.org/rfc/rfc9106.html">Argon2 RFC 9106</a> · <a href="https://nvlpubs.nist.gov/nistpubs/ir/2024/NIST.IR.8459.pdf">NIST IR 8459</a> · <a href="https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html">OWASP 암호 저장 안내</a></p><small>측정 시각: ${escapeHtml(measuredAt)} (Asia/Seoul). 실제 수치: raw-md-security-benchmark.json. 재생성: npm run test:security 후 node scripts/security-report.mjs &lt;JSON&gt; &lt;HTML&gt;.</small></main></html>`
  await writeFile(output, html)
  await writeFile(
    `${output.replace(/\.html$/, '')}.models.json`,
    `${JSON.stringify(
      {
        rates,
        estimates,
        model: 'uniform random; approximate average N/2; classical offline guessing',
        threshold: { rate: 1e12, averageYears: 100 },
      },
      null,
      2,
    )}\n`,
  )
  console.log(`Security report saved: ${output}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
