# 코드와 변경 내역

백틱 세 개 뒤에 언어 이름을 적으면 하이라이팅됩니다. 코드 내용과 들여쓰기는 그대로 유지합니다.

## Diff · 추가와 삭제

```diff
diff --git a/config.ts b/config.ts
--- a/config.ts
+++ b/config.ts
@@ -1,2 +1,2 @@
-const title = "이전 제목";
+const title = "새 제목";
 const enabled = true;
```

## TypeScript

```typescript
// 문서 제목을 표시합니다.
export function heading(title: string): string {
  return `# ${title}`;
}
```

## JavaScript

```javascript
const tasks = ["작성", "확인", "공유"];
console.log(tasks.map((task, i) => `${i + 1}. ${task}`));
```

## Python

```python
def greet(name: str) -> str:
    return f"안녕하세요, {name}!"
```

## JSON과 YAML

```json
{ "title": "회의 메모", "shared": true, "items": 3 }
```

```yaml
title: "회의 메모"
shared: true
items: 3
```

## Bash와 SQL

```bash
# 파일 내용을 확인합니다.
cat "document.md"
```

```sql
SELECT title, updated_at
FROM documents
WHERE shared = true;
```

## HTML과 CSS

```html
<article class="document">문서를 공유하세요.</article>
```

```css
.document {
  max-width: 800px;
  margin: 0 auto;
}
```

## 하이라이팅 없는 텍스트

```text
+ 이 줄은 diff가 아니므로 추가 색상을 입히지 않습니다.
<script>실행하지 않고 텍스트로 보여줍니다.</script>
```
