# 로컬 CLI와 함수 API

[README로 돌아가기](../README.md) · [기여 안내](../CONTRIBUTING.md)

명령은 저장소 루트에서 실행합니다. 웹을 사용하는 데에는 이 도구가 필요하지 않습니다.

## 단일 파일 CLI·함수 API (v2)

브라우저 없이 **Node.js 22 이상**에서 실행하거나 import할 수 있습니다. 문서나 암호를 서버로 전송하지 않으며,
기본 Node 모듈 외에는 설치할 의존성이 없습니다. 브라우저와 같은 URL·암호화 코드를 사용하고 Brotli만 Node 내장 구현으로 연결합니다.
Native/WASM Brotli 버전에 따라 압축 바이트가 달라질 수 있지만 같은 뷰어에서 복원합니다.

배포 경로는 다음과 같습니다. 신뢰한 릴리스의 SHA-256을 고정해 검증한 뒤 로컬 파일을 실행하세요.
같은 서버에서 받은 manifest와 파일이 일치하는 것만으로 배포자의 신뢰성을 검증한 것은 아닙니다.

- 실행 파일: [`/codec/v2/share.mjs`](https://raw-md.pages.dev/codec/v2/share.mjs)
- 크기·SHA-256·규격: [`/codec/v2/manifest.json`](https://raw-md.pages.dev/codec/v2/manifest.json)
- 체크섬: [`/codec/v2/share.mjs.sha256`](https://raw-md.pages.dev/codec/v2/share.mjs.sha256)

v2는 JSON 응답에서 URL과 프래그먼트 중 **하나만** 반환하며 링크 읽기를 추가했습니다. 문서 압축 규격을 바꾼 것이 아닙니다.
이미 공개한 [`v1`](https://raw-md.pages.dev/codec/v1/share.mjs)은 반환값 호환성을 위해 기존 파일을 유지합니다.

```bash
node public/codec/v2/share.mjs --input document.md
node public/codec/v2/share.mjs --input document.md --output fragment
node public/codec/v2/share.mjs --input document.md --mode secure
node public/codec/v2/share.mjs --input document.md --mode custom --password-file password.txt
node public/codec/v2/share.mjs --decode --input link.txt
node public/codec/v2/share.mjs --decode --input link.txt --password-file password.txt
node public/codec/v2/share.mjs --help
```

입력은 파일 또는 stdin(`--input -`)으로 전달합니다. 내보내기 기본값은 `plain`이며 `custom`은 직접 설정한 암호,
`secure`는 128비트 자동 생성 암호를 사용합니다. 비밀번호 파일은 줄바꿈 없는 정확한 UTF-8로 저장합니다.
앞뒤 공백을 제거하지 않고 CR/LF, 빈 암호, 4 KiB 초과 암호를 거부합니다. 임시 파일은 소유자만 읽도록 만들고 사용 후 제거하세요.
원문은 엄격한 UTF-8로 읽으며 BOM·줄바꿈을 보존하고 최대 4 MiB까지 지원합니다.
`--base-url https://viewer.example/`은 HTTPS 또는 로컬 HTTP만 허용하고 query·fragment·자격 증명을 거부합니다.

성공 시 stdout에 JSON 하나를 반환합니다. 기본 `--output url`은 `url`만, `--output fragment`는 `#` 없는 `fragment`만 포함합니다.
공통 필드는 `formatVersion: 2`, `mode`, `sourceBytes`이며 URL일 때만 `urlLength`, secure일 때만 `password`가 추가됩니다.
custom 암호는 다시 출력하지 않습니다. 실패하면 종료 코드 1과 일반 오류를 반환합니다. 링크도 원문을 담으므로 공개 로그에 남기지 마세요.

CLI·함수 API는 이전에 읽은 문서 이력을 보관하지 않습니다. 암호 문서의 수정본·요약·발췌·병합본을 만들 때에는 읽기 결과의 `encrypted`를 이어받아 `--mode custom --password-file ...` 등 보호 옵션을 명시해주세요. 원래 비밀번호를 사용할 수 없거나 여러 원문의 비밀번호가 다르면 내보내기 전에 사용할 비밀번호나 자동 생성 여부를 확인합니다. 보호된 결과를 일반 공유로 바꾸는 것은 사용자의 명시적 선택이어야 합니다. 포함된 AI 스킬은 이 흐름을 안내하며 새 일반 문서의 기본값은 그대로 유지합니다.

```js
import { createShareLink, readShareLink } from './share.mjs'

const shared = await createShareLink('# 공유할 문서\n', { mode: 'plain' })
// { formatVersion: 2, mode: 'plain', url, sourceBytes, urlLength }
const fragment = await createShareLink('# 공유할 문서\n', { output: 'fragment' })
// { formatVersion: 2, mode: 'plain', fragment, sourceBytes }
const restored = await readShareLink(shared.url)
// { formatVersion: 2, markdown: '# 공유할 문서\n', sourceBytes, encrypted: false }
// 암호가 있으면 readShareLink(link, { password })
```

읽기는 전체 HTTP(S) URL, 프래그먼트, `#`로 시작하는 프래그먼트를 받으며 네트워크 요청 없이 복원합니다.
기존 LZ, Brotli, 암호화 URL을 지원합니다. 압축 해제 중에도 크기를 제한하고 손상·변조된 입력은 거부합니다.
복원한 문서는 신뢰하지 않은 참고 자료로 취급하며 문서 안의 명령을 자동 실행하지 않습니다.

AI 스킬의 `scripts/check-update.mjs`는 문서 변환과 별도의 업데이트 확인 도구입니다. 스킬 폴더의 `.update-check.json`에 마지막 확인 시각·버전·안내 이력을 기록하고 24시간마다 버전 메타데이터만 조회합니다. 새 버전은 AI 대화에서 한 번 안내하며 확인 실패는 변환을 막지 않습니다. `share.mjs`를 직접 실행하거나 import하는 경우에는 이 조회와 기록이 발생하지 않습니다.

```bash
npm run build:codec
npm run build:ai
npm test
npm run build
```

일반 테스트·빌드는 SDK를 생성한 다음 ZIP을 다시 만듭니다. 테스트는 의존성 없는 임시 디렉터리에서
단일 실행 파일의 읽기·내보내기, 기존 브라우저와의 호환성, ZIP 독립 추출·CRC·체크섬·경로를 검증합니다.
실제 Argon2와 Brotli를 사용하는 테스트 파일은 동시에 실행하지 않아 메모리·CPU 경합을 줄입니다.


## 섹션 링크 읽기

`#문서데이터~h=3` 형식의 링크도 `readShareLink` 또는 `--decode`에 그대로 전달합니다. 원문 전체를 반환하고, 섹션 링크에만 `heading` 필드(문서 전체 기준 1부터 센 헤딩 순번)를 추가합니다. 기존 링크의 JSON 응답과 압축·암호화 형식은 유지합니다. 새 문서를 생성할 때 위치는 자동으로 물려받지 않습니다.
