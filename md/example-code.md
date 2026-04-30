# 💻 ตัวอย่างเอกสาร — Code & Technical

> **ทดสอบ:** Code blocks, bar charts, technical content

---

## Code Block — JavaScript

```javascript
const express = require('express');
const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Code Block — Python

```python
import tensorflow as tf
from tensorflow import keras

model = keras.Sequential([
    keras.layers.Dense(128, activation='relu'),
    keras.layers.Dropout(0.2),
    keras.layers.Dense(10, activation='softmax')
])

model.compile(optimizer='adam', loss='sparse_categorical_crossentropy')
```

## Code Block — Bash

```bash
# Install and convert
npm install -g md2pdf-th
md2pdf document.md
md2pdf --css dark.css doc.md -o ./output
```

---

## Bar Chart (ASCII)

```
ทักษะปัจจุบัน:                    ทักษะที่ขาด:
██████████ Cloud Security          ░░░░░░░░░░ AWS/GCP certification
██████████ Penetration Testing     ████░░░░░░ OSCP / practical experience
██████████ CI/CD Pipeline          ███░░░░░░░ GitHub Actions / ArgoCD
██████████ Team Leadership         ██░░░░░░░░ Mentoring / presenting
██████████ Executive Communication ░░░░░░░░░░ Business-level presentation
```

---

## Skill Rating

```
Web Development:        ████████░░  8.5/10
Mobile Development:     ████████░░  8/10
AI/ML:                  ████████░░  8.5/10
gRPC/Microservice:      █████████░  9/10
Security:               █████████░  9.5/10
DevOps:                 ███████░░░  7.5/10
IoT/Embedded:           ███████░░░  7/10
Agent Framework:        █████████░  9/10
Testing:                ████████░░  8/10
System Design:          █████████░  9.5/10
```

---

## Inline Code + Technical Terms

- Environment variable: `NODE_ENV=production`
- API endpoint: `https://api.example.com/v1/users`
- Command: `npx md2pdf-th README.md`
- Config: `~/.config/md2pdf/config.json`

---

## สรุป

เอกสารนี้ทดสอบ code blocks (JS, Python, Bash), ASCII bar charts, inline code และเนื้อหาทางเทคนิค
