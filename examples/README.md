# 렌더링 예시

[README의 예시 링크](../README.md#직접-열어보세요)를 열면 실제 raw-md 화면에서 확인할 수 있습니다.

| 원문 | 확인할 것 |
| --- | --- |
| [markdown.md](markdown.md) | 제목, 강조, 인용, 목록, 체크리스트, 표, 링크, 외부 이미지 |
| [code.md](code.md) | diff와 주요 언어 하이라이팅, 원문·들여쓰기 보존 |
| [math.md](math.md) | 인라인·블록 수식, 행렬, 수식 정렬 |
| [diagrams.md](diagrams.md) | 플로우차트·시퀀스·상태·ER·파이·마인드맵 |

공유 링크는 생성 시점의 문서 사본입니다. 이 파일을 고쳐도 이미 생성한 링크는 바뀌지 않습니다.

## 예시 링크 갱신하기

저장소 루트에서 실행합니다.

```sh
npm run build:codec
node public/codec/v2/share.mjs --input examples/markdown.md
node public/codec/v2/share.mjs --input examples/code.md
node public/codec/v2/share.mjs --input examples/math.md
node public/codec/v2/share.mjs --input examples/diagrams.md
```

각 JSON의 `url`로 README 하단의 `example-*` 참조 링크를 바꿉니다. 링크를 열어 화면을 확인하고, CLI로 복원한 `markdown`이 원문과 일치하는지도 확인해주세요. 공개 예시에는 실사용 비밀번호나 개인정보를 넣지 않습니다.

기본 Markdown 예시의 이미지는 공개 GitHub 서버에서 가져옵니다. 이미지 표시에는 네트워크 연결이 필요합니다. 나머지 예시의 문서 본문은 링크에 들어 있습니다.
