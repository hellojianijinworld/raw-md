[한국어](README.md) · [English](README.en.md)

<div align="center">

# raw-md

### A lightweight way to send a document. One link.

Write Markdown and copy the link. Recipients read it in their browser, with no installation.

**No installation · No server-side document storage · Optional password protection**

[Open raw-md](https://raw-md.pages.dev/) · [Rendering examples](#try-it-yourself) · [Contribute](CONTRIBUTING.md) · [Security and privacy](SECURITY.md)

</div>

---

## Write, preview, and share

| Write | Preview | Share |
| --- | --- | --- |
| Meeting notes and decisions | Headings, lists, tables, checklists | Send a single link |
| Code explanations and changes | Syntax highlighting and diffs | Check the source size and copy |
| Design and study notes | Diagrams and math | Add a password when needed |

There is no document upload or account registration. raw-md compresses the content into the URL and restores it in the recipient's browser. Choose a light or dark theme in the menu.

Korean and English are supported. The initial language follows your browser preferences. Choose **Menu → Language** to override it; your selection is remembered in this browser. Document content and titles are not translated.

### Create a link

1. Open [raw-md](https://raw-md.pages.dev/) and write Markdown.
2. Choose **Link**. **Public link** is the default option.
3. Choose **Copy share link** and paste it wherever you want.

Recipients open the link to read the document. They can choose **Edit**, make changes, and share a new link. Creating a new link does not change the content of an earlier one.

To protect the document, select **Password protection** and enter a password or choose **Generate a strong password**. The password is not included in the link; send it separately. See the [security guide](SECURITY.md) for storage behavior and protection limits.

## Try it yourself

These links open **real rendered documents**, not screenshots. View and edit the source to make your own version.

| Example | Contents | Markdown source |
| --- | --- | --- |
| [Basic Markdown][example-markdown] | Headings, emphasis, quotes, lists, tables, checklists, links, images | [Source](examples/markdown.md) |
| [Code and diffs][example-code] | Added and removed lines, TS, JS, Python, JSON, YAML, Bash, SQL, HTML, CSS | [Source](examples/code.md) |
| [Math notes][example-math] | Inline math, sums and distributions, matrices, aligned equations | [Source](examples/math.md) |
| [Diagrams][example-diagrams] | Flowcharts, sequences, states, ER, pie charts, mind maps | [Source](examples/diagrams.md) |

Use fenced code blocks with three backticks followed by a language name, such as `diff`, `typescript`, or `python`. Omit the language or use `text` for plain text. Write math as `$...$` or `$$...$$`, and diagrams inside `mermaid` code blocks.

Diagrams adapt to the viewport and theme, but their layout may differ from Mermaid.js. Arbitrary HTML labels and some syntax or settings may render differently. Links and external images within diagrams are disabled. Arbitrary HTML page customization is not supported.

### Link to a section

Use standard Markdown links such as `[Usage](#usage)`. Korean headings and repeated headings are handled too. Copy the `#` link beside a heading to share that section. Its position is appended to the URL fragment, for example `~h=3`, while the document and password remain the same. Existing share links continue to work.

If you have not shared a protected edit yet, section links navigate within the current document. Editing and sharing a new version resets the previous section position.

## Continue with AI

AI integration is **optional**. It lets an AI read a document link to continue a conversation, or turn the results back into a link. No setup is needed to use the website itself.

Copy this prompt into **Codex or Claude Code**. It is also available under **Menu → Help → AI integration** on the website.

> Read the instructions below and install the raw-md skill in my current AI environment.
> https://raw-md.pages.dev/ai/INSTALL.md

| Goal | Example prompt |
| --- | --- |
| Read a document | “Read this raw-md link and summarize the key points.” |
| Continue the context | “Plan the next steps based on the decisions in this document.” |
| Improve a document | “Read this link and make the content easier to follow.” |
| Share the result | “Turn what we just organized into a raw-md link.” |

Links are decoded locally, but any content you give to AI is processed by your chosen AI service. See the [AI installation guide](integrations/ai/INSTALL.md) for setup details.

## Good to know

- **Keep your links.** The server cannot retrieve, revoke, delete, or expire shared documents. Anyone with a public link can read it.
- **Link length depends on the document.** raw-md chooses the shorter compression result when copying. Long documents can still exceed character limits in Slack or other services. The maximum restorable source size is 4 MiB in UTF-8; this does not mean every document of that size can be shared everywhere.
- **Source size counts UTF-8 bytes.** This differs from character count and URL length. Korean characters and emoji can use multiple bytes per character. Sizes are displayed in B, KB, MB, or GB.
- **My documents is local to this browser.** Its limit adapts to the browser's estimated free storage, up to 1 GB. When space runs low, older documents without the Keep setting are removed first. Download important documents as Markdown files using the document's download button.
- **Encrypt protected edits before saving.** Changes to a protected document stay in the current tab until you copy a new link or encrypt and save them to My documents.
- **Check the version in settings.** The menu shows the reference GitHub release at build time and the actual build commit.

Use **⌘K / Ctrl+K** to open My documents, type to search, and press Enter to open a result. Mark documents with the bookmark icon to exclude them from automatic cleanup. Browser data deletion can still remove them.

## Help improve raw-md

Report problems and ideas through [GitHub issues](https://github.com/hellojianijinworld/raw-md/issues). [Contributions](CONTRIBUTING.md), including typo fixes and new examples, are welcome.

See the [contribution guide](CONTRIBUTING.md) for development and PR steps, [security and privacy](SECURITY.md) for storage and password protection, and the [CLI guide](docs/CLI.md) for creating and reading links directly. These supporting guides are currently in Korean; the AI installation guide is in English.

---

<div align="center">

Made by [hellojianijinworld](https://github.com/hellojianijinworld)

</div>

[example-markdown]: https://raw-md.pages.dev/#j1.fgQAAL_OVNobfwQALg540xd0jVrD8OEwT5YuUwo0QZNWfJfCKk0AL7V-2fi0tlbjLzGAJKFQt8LOZTitHebRgJd6fAKtL2FrYEbbWQg0ddfn8_en6scARmMJAK6X0bU3lnsRKuVqse5BNM2tgYQgKEGmzt1N94zwbcah2cBQIIAKmG9wEDdG7vnow9-d8jAKDubmBMsyN7eAOQlumVfmdTr9HxNjwv8u4JCJAhMMpLFDdVHwfg8YcFZQ2ALzb_6FaKBybnwclODyBdH4h3hEcZu6MfI0fzNoqnZFklBSXVMsAcZ0bM9Mg5ZyvWoHR-U2kfChAwPFqx1l-wHyj4Fk6udWJvQMM3JolS3jQLOBqfPY-dzTsxQZZ1x7gkSsDI2k10oo95j0QQDIYBg86Qw6LV-qUOosD6EoxOhIZPJsiCP3c8sV_gYvRJ3qaKqOTdMoSGgFyDKI7IkF4HYnbHgghYw-hhZOcwvZ0qhCGDYsVdfCqvceUbvaVigPvhaly6B0MycXizwJtS3wRkdiVepID3m8D601ZYHZSDPzeWJPoIdvCNW6G0kyVr4IGVpXMfWTm_yW48SOlq0gRJz3Hj_QwzBZyYiRset2toQa2JXYm_mFWa5JW33M8_Lp2Xs9i_-RPhkaTZ68VQxRdo6gNZ8nOIRgUte2rl63346RKWOmZTmQtkqU1WYCH2nFmEu1M0RZpfVMBUef43bOiMkNo_jwUow38hQVEdrK6uLq9fLt2AuBJ2GPxil1fXV0f_WgvXcwkDW1u8rVL88ntZceq88yIPPyfjHrAA
[example-code]: https://raw-md.pages.dev/#j1.dQUAAPRuMYobdgUAngd2rGNyLQyTxzv5le43Q7lN9bh8j-FWilV48l3BbxLs2MNSlA2EzmW0vYwwKn8P1U293h73mYCKpRXWLHHr__-lgYSjxRKRnDDO3PdLaisi0VjES8NZX4ElXBVxO9C7dX2WIf7XDPy0UHjDe1XWIiCuEL0zvw5UgiSEH07gKAewvepjDXSE5a2KCGZR_fjXG54XWAjOfmjr83flhlBz-p1PkRaokBLSawM_2iKs_yMiw8BOpVjE_9hZ30NC4z6F6LSIyfO8vJMG1mHbpUofvns0r5x-D9lxP9nng-ySTNMslzc2YE9aUzAHlAlRst-3nd9r-48Em45Cp7eOWCbzfKYo04FfW-MBHlQmZwEhDGrkDMIIm7TlunibqtgeDH35dynL8I_UkEERx78rpU94CYD3pkcyuKc7XFuegdj9or1Hb5kelQIb2e4hxE2OIb5REw3nQiMqVlgQ0Q67Yw9kLz_icpm8esupt0qp9VpOw2-nSg0WKmmsrsGL3VdgYvLRUUedqRSGdHp55PC2X241NXG3R0v5QhGvdmn3U02_4cRiGvaa1JYISDQVBaNBbQQq8WXhfq3c47jYA8gFMCydbu7t7gfkWqJ7CLt8F0sQ0cE_vKW35kDmDz3idp5L-FF1UngaJsRA69Zv1Gkzx8VNCRMXJapIpSxbfq_M4ZMjcWSnFcnAn1_yjL8BDpjB90-9nN-HYLRcIy8U8vc6wv_3ZXopMOep4rXfp38IRTKGi_6IFKh5CqlgMRgstX1yIggXorQSIPGrYuINjhl2y68aYEIei6izQvS-NUXtufX15BBKMw3_5uayayEcjBFudoFo90F7lHKK4PjpZO03o-RX9ADSS5CJxRrQM5yBK25KAENgb2IeRi1GKIYMrmTmF5meAeMq2V2EUQ3liYg1sVhOtr0Tl1m9Ny56Tj0_C24A
[example-math]: https://raw-md.pages.dev/#j1.hAIAAPyJdCobgwIAHgl2LOIfCKlu8lV_tnuZnvRdoow94P20u0AYpcApkNOtpIoO9Z8jiEBrrZLrCAbhygpv-qmb-uKJ5PiLPhu0Nm2QZWWFPBZ1WYDLcm4ePdFRkeDMNugDB1bY6ORgjTvZeELWxaq4GyLHwU4-YzjBp0_QEtFpsSLncGqwnGznKPcu2ovDygb_4Q2NXFLxKV2FNQjTs7V9Af97vyCNSh7fPr6SLQ8XPA_EUcMXg6Ws-NssWoFTPmtNPIvr0jZdX_vjrb0rsBJ3jP3ricaJmEl6g0ZK195iJqmbBjW8QYrdTE43vc1AzGe0MsRMdOYWj738KE4f7JJ18cRZoRYWvWOfwpWY0dKrlBoZ6XW6fa2kXTGGpDBuS6Zlb4gKwwZC0hj4kspo1REUpCDMp4sflH-ObXcWeWVE1Dop-SGdbWT63crYIAM3shBBboC8WWjmCfUBbExumxD736DLjQPZCQSt-ZAOsxfyGewV8oa8mUDWl1RwvwGSQwQRwnbG_YZMUiEAlckigGxSUSPfiVTIJxw
[example-diagrams]: https://raw-md.pages.dev/#j1.hgUAAJZxRWAbhQUgngd2TJgCIsJMx76Tr-q-3cv0_gFCYbup6wFT1JAsFxMgkG1GTdWOkNUV9eHyIXRNo-0VAovsi4rN_-VedtcEDxdIiAndn61JY00aCygtzoujsXFNoYBqEc_tdKDq0r5u98ICIVIWhyizkTvQkBCBfuFYooPb06fbw8uTA9RNG7xre8RsQzDrVRvUjlqsC1bdvMDLQ2MMAjtAFtbzH9f0A8UvjkFJW9Ga-04fMX6ibsuzqk8-7dBG88FUT8mPWqzqrYywuc1UWjCs221CH4m-fbjUK6GBIffWfwkRyUU_gjzk-om3JfVE6Tibq22XWrfomORPbGhh06fnxyVItz2f94cwLCtFFRSKpoTCBPqDvJ2Go_6FLU3aXaZlizwV2jDCzflZbOLw2ftBBfD86JfeLOQpNOdnnWbDmKZG19aipdebhi3JLMmzcwjRKJLZ7AwAx6ocxzomQxjqOOjZTBLVyKwKeUxG0m9Me3EEZwSuGTOU-cmsbvRtirA9lP7o_o1OwlEExD8LDglVI2THXgRUGx9HJOWnUHNVOvycXS1LCHskkUOGsIdGUC9c0GU-05By07nkjrUlKP5rj9T8_IyO3n9_paCGpRsk_c8EMCGjX88sr__icJb5JuA6UVRXdMBI5cCQ5ddSl3qiMtGHfN14Hi5PpZBkItSkkEcIXdVASReWMDsBwtUH7AXT3VIQ4pgpqlzvCCZHmxtvAevH1O3hA-FrnTYNZDlsyMzBQQIQDvmDVYprBJeaTT4ZIwB7aMUnXgQKSQkAq2pB3hpzN3OwNbV1Dlr3SEakfR3Dfih0Nh1ynp4u44czrgI
