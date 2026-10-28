<div align="center">

# raw-md

### 문서를 보내는 가장 가벼운 방법, 링크 하나.

Markdown을 작성하고 링크를 복사하세요. 받은 사람은 설치 없이 브라우저에서 바로 읽습니다.

**설치 없이 · 서버에 문서 저장 없이 · 필요할 때 비밀번호 보호**

[바로 사용하기](https://raw-md.pages.dev/) · [렌더링 예시](#직접-열어보세요) · [기여하기](CONTRIBUTING.md) · [보안과 개인정보](SECURITY.md)

</div>

---

## 작성하고, 확인하고, 공유하세요

| 작성하고 | 확인하고 | 공유하세요 |
| --- | --- | --- |
| 회의 메모와 결정 사항 | 제목·목록·표·체크리스트 | 링크 하나로 전달 |
| 코드 설명과 변경 내역 | 언어별 하이라이팅·diff | 원문 크기를 확인하고 복사 |
| 설계와 학습 노트 | 다이어그램·수식 | 필요하면 비밀번호로 보호 |

별도의 문서 업로드나 계정 등록이 없습니다. 내용을 압축해 URL 안에 담고, 받은 사람의 브라우저에서 복원합니다. 라이트·다크 테마는 메뉴의 설정에서 선택할 수 있습니다.

### 링크 하나 만들기

1. [raw-md](https://raw-md.pages.dev/)를 열고 Markdown을 작성합니다.
2. **링크** 버튼을 누릅니다. 기본값인 **그냥 공유**로 바로 사용할 수 있습니다.
3. **공유 링크 복사하기**를 누르고 원하는 곳에 붙여넣습니다.

받은 사람은 링크를 열어 문서를 읽습니다. **수정**을 눌러 내용을 바꾼 뒤 새 링크로 공유할 수도 있습니다. 새 링크를 만들어도 이전 링크의 내용은 바뀌지 않습니다.

비밀번호가 필요하면 **직접 설정**을 선택하고 비밀번호를 입력하거나 **강력한 암호 자동 생성**을 누르세요. 비밀번호는 링크에 포함되지 않으므로 따로 전달해야 합니다. 저장 범위와 보호의 한계는 [보안 안내](SECURITY.md)에 정리했습니다.

## 직접 열어보세요

아래 링크는 스크린샷이 아니라 **실제로 렌더링되는 공유 문서**입니다. 원문을 보고 수정해 나만의 문서로 만들어보세요.

| 예시 | 담긴 내용 | Markdown 원문 |
| --- | --- | --- |
| [기본 Markdown 열기][example-markdown] | 제목, 강조, 인용, 목록, 표, 체크리스트, 링크, 이미지 | [원문](examples/markdown.md) |
| [코드와 diff 열기][example-code] | 추가·삭제 표시, TS·JS·Python·JSON·YAML·Bash·SQL·HTML·CSS | [원문](examples/code.md) |
| [수식 노트 열기][example-math] | 문장 안의 수식, 합과 분포, 행렬, 정렬된 식 | [원문](examples/math.md) |
| [다이어그램 열기][example-diagrams] | 플로우차트, 시퀀스, 상태, ER, 파이 차트, 마인드맵 | [원문](examples/diagrams.md) |

코드는 GitHub에서 쓰는 것처럼 백틱 세 개 뒤에 `diff`, `typescript`, `python` 등의 언어 이름을 적습니다. 언어를 생략하거나 `text`로 지정하면 일반 텍스트로 표시합니다. 수식은 `$...$` 또는 `$$...$$`, 다이어그램은 `mermaid` 코드 블록으로 작성합니다.

다이어그램은 화면과 테마에 맞춰 표시하지만 Mermaid.js와 배치가 다를 수 있습니다. 임의의 HTML 라벨, 일부 세부 문법·설정은 결과가 다를 수 있으며 다이어그램 안의 링크와 외부 이미지는 비활성화합니다. 임의의 HTML을 넣어 페이지를 꾸미는 용도로는 지원하지 않습니다.

### 문서의 특정 부분으로 이동하기

`[사용법](#사용법)`처럼 일반 Markdown 내부 링크를 사용할 수 있습니다. 한글 제목과 반복되는 제목도 구분하며, 제목 옆 `#` 링크의 주소를 복사하면 해당 섹션을 공유할 수 있습니다. 섹션 위치는 URL 프래그먼트에 `~h=3`처럼 추가되고 문서·비밀번호는 그대로 유지됩니다. 기존 공유 링크도 계속 열립니다.

보호된 수정본을 아직 공유하지 않았다면 섹션 링크 대신 문서 안에서만 이동합니다. 문서를 수정해 새로 공유하면 이전 섹션 위치는 초기화됩니다.

## AI와 이어서 사용하기

AI 연동은 **문서 링크를 읽고 대화를 이어가거나, 정리한 결과를 다시 링크로 만드는 선택 기능**입니다. 웹만 사용한다면 설치할 필요가 없습니다.

아래 문장을 **Codex 또는 Claude Code**에 복사해 전달하세요. 웹의 **메뉴 → 도움말 → AI 연동**에서도 복사할 수 있습니다.

> 아래 안내를 읽고, 지금 사용 중인 AI 환경에 raw-md 스킬을 설치해줘.
> https://raw-md.pages.dev/ai/INSTALL.md

| 하고 싶은 일 | 이렇게 요청하세요 |
| --- | --- |
| 문서 읽기 | “이 raw-md 링크를 읽고 핵심 내용을 요약해줘.” |
| 맥락 이어가기 | “이 문서의 결정을 바탕으로 다음 할 일을 정리해줘.” |
| 문서 고치기 | “이 링크의 내용을 읽고 더 읽기 쉽게 다듬어줘.” |
| 결과 공유하기 | “방금 정리한 내용을 raw-md 링크로 만들어줘.” |

링크는 로컬에서 복원하지만 AI에 전달한 원문은 선택한 AI 서비스에서 처리됩니다. 자세한 설치 절차는 [AI 설치 안내](integrations/ai/INSTALL.md)에 있습니다.

## 알아두면 좋은 점

- **링크를 보관해주세요.** 서버에서 문서를 찾아주거나 삭제·회수·만료시킬 수 없습니다. 일반 링크를 가진 사람은 누구나 읽을 수 있습니다.
- **링크 길이는 문서에 따라 달라집니다.** 복사할 때 더 짧은 압축 결과를 선택하지만, 긴 문서는 Slack 등 공유하는 서비스의 글자 수 제한에 걸릴 수 있습니다. 복원 가능한 원문 상한은 UTF-8 기준 4 MiB이며 모든 크기를 공유할 수 있다는 뜻은 아닙니다.
- **원문 용량은 UTF-8 바이트 수입니다.** 글자 수나 공유 URL의 글자 수와 다릅니다. 한글·이모지 등은 한 글자가 여러 바이트를 차지할 수 있습니다.
- **보호된 수정본은 다시 복사해주세요.** 비밀번호 보호 중의 편집 내용은 새 링크로 복사하기 전까지 현재 탭에만 있습니다.
- **버전은 설정에서 확인하세요.** 배포 시점의 기준 GitHub 릴리즈와 실제 빌드 커밋으로 확인할 수 있습니다.

## 함께 개선해요

사용 중 불편한 점이나 아이디어는 [이슈](https://github.com/hellojianijinworld/raw-md/issues)로 알려주세요. 오타 수정과 예시 추가를 비롯한 [GitHub 기여](CONTRIBUTING.md)도 환영합니다.

개발과 PR 절차는 [기여 안내](CONTRIBUTING.md), 문서 저장·비밀번호 보호는 [보안과 개인정보](SECURITY.md), 직접 링크를 생성·복원하는 방법은 [CLI 안내](docs/CLI.md)에 모았습니다.

---

<div align="center">

Made by [hellojianijinworld](https://github.com/hellojianijinworld)

</div>

[example-markdown]: https://raw-md.pages.dev/#j1.fgQAAL_OVNobfwQALg540xd0jVrD8OEwT5YuUwo0QZNWfJfCKk0AL7V-2fi0tlbjLzGAJKFQt8LOZTitHebRgJd6fAKtL2FrYEbbWQg0ddfn8_en6scARmMJAK6X0bU3lnsRKuVqse5BNM2tgYQgKEGmzt1N94zwbcah2cBQIIAKmG9wEDdG7vnow9-d8jAKDubmBMsyN7eAOQlumVfmdTr9HxNjwv8u4JCJAhMMpLFDdVHwfg8YcFZQ2ALzb_6FaKBybnwclODyBdH4h3hEcZu6MfI0fzNoqnZFklBSXVMsAcZ0bM9Mg5ZyvWoHR-U2kfChAwPFqx1l-wHyj4Fk6udWJvQMM3JolS3jQLOBqfPY-dzTsxQZZ1x7gkSsDI2k10oo95j0QQDIYBg86Qw6LV-qUOosD6EoxOhIZPJsiCP3c8sV_gYvRJ3qaKqOTdMoSGgFyDKI7IkF4HYnbHgghYw-hhZOcwvZ0qhCGDYsVdfCqvceUbvaVigPvhaly6B0MycXizwJtS3wRkdiVepID3m8D601ZYHZSDPzeWJPoIdvCNW6G0kyVr4IGVpXMfWTm_yW48SOlq0gRJz3Hj_QwzBZyYiRset2toQa2JXYm_mFWa5JW33M8_Lp2Xs9i_-RPhkaTZ68VQxRdo6gNZ8nOIRgUte2rl63346RKWOmZTmQtkqU1WYCH2nFmEu1M0RZpfVMBUef43bOiMkNo_jwUow38hQVEdrK6uLq9fLt2AuBJ2GPxil1fXV0f_WgvXcwkDW1u8rVL88ntZceq88yIPPyfjHrAA
[example-code]: https://raw-md.pages.dev/#j1.dQUAAPRuMYobdgUAngd2rGNyLQyTxzv5le43Q7lN9bh8j-FWilV48l3BbxLs2MNSlA2EzmW0vYwwKn8P1U293h73mYCKpRXWLHHr__-lgYSjxRKRnDDO3PdLaisi0VjES8NZX4ElXBVxO9C7dX2WIf7XDPy0UHjDe1XWIiCuEL0zvw5UgiSEH07gKAewvepjDXSE5a2KCGZR_fjXG54XWAjOfmjr83flhlBz-p1PkRaokBLSawM_2iKs_yMiw8BOpVjE_9hZ30NC4z6F6LSIyfO8vJMG1mHbpUofvns0r5x-D9lxP9nng-ySTNMslzc2YE9aUzAHlAlRst-3nd9r-48Em45Cp7eOWCbzfKYo04FfW-MBHlQmZwEhDGrkDMIIm7TlunibqtgeDH35dynL8I_UkEERx78rpU94CYD3pkcyuKc7XFuegdj9or1Hb5kelQIb2e4hxE2OIb5REw3nQiMqVlgQ0Q67Yw9kLz_icpm8esupt0qp9VpOw2-nSg0WKmmsrsGL3VdgYvLRUUedqRSGdHp55PC2X241NXG3R0v5QhGvdmn3U02_4cRiGvaa1JYISDQVBaNBbQQq8WXhfq3c47jYA8gFMCydbu7t7gfkWqJ7CLt8F0sQ0cE_vKW35kDmDz3idp5L-FF1UngaJsRA69Zv1Gkzx8VNCRMXJapIpSxbfq_M4ZMjcWSnFcnAn1_yjL8BDpjB90-9nN-HYLRcIy8U8vc6wv_3ZXopMOep4rXfp38IRTKGi_6IFKh5CqlgMRgstX1yIggXorQSIPGrYuINjhl2y68aYEIei6izQvS-NUXtufX15BBKMw3_5uayayEcjBFudoFo90F7lHKK4PjpZO03o-RX9ADSS5CJxRrQM5yBK25KAENgb2IeRi1GKIYMrmTmF5meAeMq2V2EUQ3liYg1sVhOtr0Tl1m9Ny56Tj0_C24A
[example-math]: https://raw-md.pages.dev/#j1.hAIAAPyJdCobgwIAHgl2LOIfCKlu8lV_tnuZnvRdoow94P20u0AYpcApkNOtpIoO9Z8jiEBrrZLrCAbhygpv-qmb-uKJ5PiLPhu0Nm2QZWWFPBZ1WYDLcm4ePdFRkeDMNugDB1bY6ORgjTvZeELWxaq4GyLHwU4-YzjBp0_QEtFpsSLncGqwnGznKPcu2ovDygb_4Q2NXFLxKV2FNQjTs7V9Af97vyCNSh7fPr6SLQ8XPA_EUcMXg6Ws-NssWoFTPmtNPIvr0jZdX_vjrb0rsBJ3jP3ricaJmEl6g0ZK195iJqmbBjW8QYrdTE43vc1AzGe0MsRMdOYWj738KE4f7JJ18cRZoRYWvWOfwpWY0dKrlBoZ6XW6fa2kXTGGpDBuS6Zlb4gKwwZC0hj4kspo1REUpCDMp4sflH-ObXcWeWVE1Dop-SGdbWT63crYIAM3shBBboC8WWjmCfUBbExumxD736DLjQPZCQSt-ZAOsxfyGewV8oa8mUDWl1RwvwGSQwQRwnbG_YZMUiEAlckigGxSUSPfiVTIJxw
[example-diagrams]: https://raw-md.pages.dev/#j1.hgUAAJZxRWAbhQUgngd2TJgCIsJMx76Tr-q-3cv0_gFCYbup6wFT1JAsFxMgkG1GTdWOkNUV9eHyIXRNo-0VAovsi4rN_-VedtcEDxdIiAndn61JY00aCygtzoujsXFNoYBqEc_tdKDq0r5u98ICIVIWhyizkTvQkBCBfuFYooPb06fbw8uTA9RNG7xre8RsQzDrVRvUjlqsC1bdvMDLQ2MMAjtAFtbzH9f0A8UvjkFJW9Ga-04fMX6ibsuzqk8-7dBG88FUT8mPWqzqrYywuc1UWjCs221CH4m-fbjUK6GBIffWfwkRyUU_gjzk-om3JfVE6Tibq22XWrfomORPbGhh06fnxyVItz2f94cwLCtFFRSKpoTCBPqDvJ2Go_6FLU3aXaZlizwV2jDCzflZbOLw2ftBBfD86JfeLOQpNOdnnWbDmKZG19aipdebhi3JLMmzcwjRKJLZ7AwAx6ocxzomQxjqOOjZTBLVyKwKeUxG0m9Me3EEZwSuGTOU-cmsbvRtirA9lP7o_o1OwlEExD8LDglVI2THXgRUGx9HJOWnUHNVOvycXS1LCHskkUOGsIdGUC9c0GU-05By07nkjrUlKP5rj9T8_IyO3n9_paCGpRsk_c8EMCGjX88sr__icJb5JuA6UVRXdMBI5cCQ5ddSl3qiMtGHfN14Hi5PpZBkItSkkEcIXdVASReWMDsBwtUH7AXT3VIQ4pgpqlzvCCZHmxtvAevH1O3hA-FrnTYNZDlsyMzBQQIQDvmDVYprBJeaTT4ZIwB7aMUnXgQKSQkAq2pB3hpzN3OwNbV1Dlr3SEakfR3Dfih0Nh1ynp4u44czrgI
