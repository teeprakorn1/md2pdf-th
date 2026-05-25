# Deployment guide

> How to deploy and distribute md2pdf-th across different environments.

---

## npm publish

### Checklist

1. Update version in `package.json`
2. Update `CHANGELOG.md` with new entries
3. Run tests: `npm test`
4. Publish: `npm publish`

The `prepublishOnly` script runs tests automatically before publishing.

### Published files

Only files listed in `package.json` `"files"` are included in the npm package:

```
md2pdf.js, lib/, types/, templates/, style.css, style-dark.css,
md2pdf.bat, Dockerfile, action.yml, web-ui.html, test/, LICENSE, README.md, CHANGELOG.md
```

---

## Docker

### Build

```bash
docker build -t md2pdf-th .
```

The Dockerfile uses `node:20-slim` with system Chromium and Thai fonts (`fonts-noto`, `fonts-noto-cjk`, `fonts-noto-color-emoji`).

### Run

```bash
# Single file
docker run --rm -v $(pwd):/data md2pdf-th /data/doc.md /data/output.pdf

# With options
docker run --rm -v $(pwd):/data md2pdf-th --theme dark --toc /data/doc.md

# Batch convert
docker run --rm -v $(pwd):/data md2pdf-th -o /data/pdfs /data/*.md

# Template + watermark
docker run --rm -v $(pwd):/data md2pdf-th --template report --watermark "DRAFT" /data/report.md
```

### Environment variables

| Variable | Value in Dockerfile |
|----------|-------------------|
| `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` | `true` |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium` |
| `CI` | `true` |

### Multi-stage optimization (optional)

For smaller production images:

```dockerfile
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --production

FROM node:20-slim
RUN apt-get update && apt-get install -y \
    chromium fonts-noto fonts-noto-cjk fonts-noto-color-emoji \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CI=true
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENTRYPOINT ["node", "md2pdf.js"]
```

---

## GitHub Action

### Basic usage

```yaml
- uses: teeprakorn1/md2pdf-th@v4
  with:
    markdown-file: report.md
    output-file: report.pdf
```

### All inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `markdown-file` | Yes | — | Path to Markdown file |
| `output-file` | No | — | Output PDF path |
| `theme` | No | `light` | `light` or `dark` |
| `format` | No | `A4` | Page size |
| `toc` | No | `false` | Generate TOC |
| `cover` | No | `false` | Add cover page |
| `template` | No | — | `resume`, `report`, or `invoice` |
| `watermark` | No | — | Watermark text |
| `header` | No | — | Header text |
| `footer` | No | — | Footer text |
| `font` | No | — | Custom font family |

### Example — batch conversion workflow

```yaml
name: Generate PDFs
on:
  push:
    paths: ['docs/*.md']

jobs:
  convert:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g md2pdf-th
      - run: md2pdf-th --theme dark --toc -o ./pdfs docs/*.md
      - uses: actions/upload-artifact@v4
        with:
          name: pdfs
          path: pdfs/
```

### Example — matrix (multiple themes)

```yaml
jobs:
  convert:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        theme: [light, dark]
    steps:
      - uses: actions/checkout@v4
      - uses: teeprakorn1/md2pdf-th@v4
        with:
          markdown-file: report.md
          output-file: report-${{ matrix.theme }}.pdf
          theme: ${{ matrix.theme }}
          toc: true
```

---

## GitLab CI

```yaml
convert-pdf:
  image: node:20-slim
  before_script:
    - apt-get update && apt-get install -y chromium fonts-noto --no-install-recommends
    - export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
    - export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
    - npm install -g md2pdf-th
  script:
    - md2pdf-th --toc --cover -o ./pdfs docs/*.md
  artifacts:
    paths:
      - pdfs/
```

---

## NestJS production

### Bundle with NestJS app

```ts
import { Md2PdfModule } from 'md2pdf-th/nestjs';

@Module({
  imports: [
    Md2PdfModule.forRoot({
      theme: 'dark',
      toc: true,
      format: 'A4',
    }),
  ],
})
export class AppModule {}
```

### Docker for NestJS + md2pdf-th

Puppeteer requires Chromium at runtime. Use a Docker image with Chromium pre-installed:

```dockerfile
FROM node:20-slim

RUN apt-get update && apt-get install -y \
    chromium fonts-noto fonts-noto-cjk \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

CMD ["node", "dist/main.js"]
```

### Memory considerations

Each PDF conversion spawns a Chromium instance. For high-throughput APIs:

- Set `--max-old-space-size` for Node.js
- Limit concurrent conversions (use a queue)
- Consider a dedicated PDF worker service

---

## Serverless limitations

md2pdf-th relies on Puppeteer (Chromium), which has limitations in serverless environments:

| Platform | Support | Notes |
|----------|---------|-------|
| **Docker-based** (ECS, Cloud Run) | Yes | Full support with Chromium |
| **AWS Lambda** | Limited | Requires `chrome-aws-lambda` layer (~50MB), cold start ~5s |
| **Vercel Functions** | No | 50MB limit, no Chromium |
| **Cloudflare Workers** | No | No binary execution |

**Recommendation:** Use Docker-based deployment (ECS, Cloud Run, Railway, Fly.io) for production.
