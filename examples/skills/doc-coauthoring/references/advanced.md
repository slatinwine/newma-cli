# Advanced Documentation Topics

This reference covers advanced documentation techniques for teams scaling their documentation efforts.

## Internationalization (i18n)

### Strategy

1. **Separate Content from Code**
   - Store docs in translation-friendly formats (Markdown, JSON)
   - Use i18n keys for UI strings
   - Keep code examples language-agnostic

2. **Translation Workflow**
   - Use professional translation for official docs
   - Community translations for other languages
   - Maintain terminology glossaries

3. **Tools**
   - Crowdin, Poedit, or i18next for managing translations
   - Automated checks for missing translations
   - CI/CD integration

### Example Structure

```
docs/
  en/
    api.md
    tutorials.md
  zh/
    api.md
    tutorials.md
  es/
    api.md
    tutorials.md
```

---

## Documentation as Code

### Principles

1. **Version Control**: Docs in git alongside code
2. **Code Review**: PRs for doc changes
3. **CI/CD**: Automated testing and deployment
4. **Collaboration**: Same workflow as code

### Tooling

**Static Site Generators**:
- **Docusaurus** (React-based, feature-rich)
- **VitePress** (Vue-powered, fast)
- **MkDocs** (Python, simple)
- **Hugo** (Go, extremely fast)

**Example Pipeline**:
```yaml
# .github/workflows/docs.yml
name: Documentation
on:
  push:
    branches: [main]
    paths: ['docs/**']

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build docs
        run: |
          npm install
          npm run build:docs
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs/build
```

---

## Automated Testing of Docs

### Types of Tests

1. **Link Checking**
   ```bash
   # Find broken links
   npx markdown-link-check docs/**/*.md
   ```

2. **Code Example Testing**
   ```python
   # Test Python code blocks in docs
   import pytest
   import subprocess

   def test_code_examples():
       result = subprocess.run(
           ['python', '-m', 'doctest', 'docs/api.md'],
           capture_output=True
       )
       assert result.returncode == 0
   ```

3. **Spelling and Grammar**
   ```bash
   # Check spelling
   npx cspell "docs/**/*.md"

   # Check grammar (with write-good)
   npx write-good docs/**/*.md
   ```

4. **Style Consistency**
   ```bash
   # Lint markdown
   npx markdownlint docs/**/*.md
   ```

### Continuous Integration

```yaml
name: Doc Tests
on: [pull_request]

jobs:
  test-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check links
        run: npx markdown-link-check docs/**/*.md
      - name: Lint markdown
        run: npx markdownlint docs/**/*.md
      - name: Check spelling
        run: npx cspell "docs/**/*.md"
```

---

## Versioning Strategies

### Options

1. **Version Branches**
   ```
   docs/
     main/
     v1.0/
     v2.0/
   ```

2. **URL Versioning**
   ```
   https://docs.example.com/v1/api
   https://docs.example.com/v2/api
   ```

3. **Semantic Versioning in Content**
   ```markdown
   > [!NOTE]
   > This feature is available in v2.0+. For v1.x, see [legacy docs](...).
   ```

### Tool Support

- **Docusaurus**: Built-in versioning
- **VitePress**: Version dropdowns
- **MkDocs**: `mike` for versioning

### Example Docusaurus Config

```javascript
// docusaurus.config.js
module.exports = {
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          versions: {
            current: {
              label: '2.0.0 (Next)',
              path: '/',
            },
            '1.9': {
              label: '1.9.0',
              path: '/v1.9',
            },
          },
        },
      },
    ],
  ],
};
```

---

## Metrics and Analytics

### Key Metrics

1. **Page Views**: Most visited pages
2. **Time on Page**: Engagement depth
3. **Search Queries**: What users look for
4. **Exit Rate**: Where users leave
5. **Feedback**: Helpful/not helpful ratings

### Tools

- **Google Analytics** / **Plausible** (privacy-friendly)
- **Hotjar** / **CrazyEgg** (heatmaps)
- **Algolia DocSearch** (search analytics)
- **Custom feedback widgets**

### Example: Feedback Widget

```html
<!-- In your doc footer -->
<div class="doc-feedback">
  <p>Was this page helpful?</p>
  <button onclick="feedback('yes')">👍 Yes</button>
  <button onclick="feedback('no')">👎 No</button>
</div>

<script>
function feedback(type) {
  fetch('/api/feedback', {
    method: 'POST',
    body: JSON.stringify({
      page: window.location.pathname,
      helpful: type === 'yes'
    })
  });
}
</script>
```

---

## Documentation Anti-Patterns (Advanced)

### 1. The "Wall of Text"

**Problem**: Dense paragraphs without structure

**Solution**:
- Use headings every 300-500 words
- Break into bullet lists
- Add diagrams and code examples

### 2. The "Examples Assumptions"

**Problem**: Examples assume context reader doesn't have

**Solution**:
- Show complete, runnable examples
- Include setup steps
- Use placeholder data that's realistic

### 3. The "Version Confusion"

**Problem**: Unclear which version docs apply to

**Solution**:
- Always show version in header
- Highlight version-specific features
- Link to migration guides

### 4. The "Stale Docs"

**Problem**: Documentation out of sync with code

**Solution**:
- Require doc updates in PRs
- Automated tests that check docs
- Doc linters in CI

---

## Best Practices Summary

### Writing

1. **Start with user's goal**, not the feature
2. **Show, then tell** (code first, explanation after)
3. **Use progressive disclosure** (simple → advanced)
4. **Test every example** (copy-paste and run)
5. **Update as you code** (not as a separate task)

### Structure

1. **Clear hierarchy** (H1 → H2 → H3)
2. **Descriptive headings** (not "Introduction", "Overview")
3. **Table of contents** for long docs
4. **Related links** at bottom of each page
5. **Navigation breadcrumbs**

### Maintenance

1. **Docs as code** (PR reviews, CI/CD)
2. **Automated testing** (links, spelling, examples)
3. **Version control** (git branches/tags)
4. **Regular audits** (quarterly reviews)
5. **User feedback** (analytics, surveys)

---

## Further Reading

- [Google Developer Documentation Style Guide](https://developers.google.com/tech-writing)
- [Write the Docs](https://www.writethedocs.org/)
- [Documentation Engineering](https://www.divio.com/blog/documentation/)
- [The Diátaxis Framework](https://diataxis.fr/)
