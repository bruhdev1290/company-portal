# Company Portal – AI Complaint Triage
# Company Portal – AI Complaint Triage

**Note: Docker support is temporarily removed. The Dockerfile and related instructions are disabled while troubleshooting dark mode and other issues.**

This project is a static complaint portal enhanced with an AI (Claude) backend service that analyzes visible complaints, assigns priority (urgent / medium / low), calculates a risk score, and highlights potential CFPB-relevant issues.

## Key Features
- Static HTML front-end (no build chain required)
- AI analysis endpoint (`/analyze-complaints`) powered by Claude
- Structured JSON output: id, priority, summary, risk_score, issues[]
- Front-end panel on `complaints-active.html` to request analysis and visually mark rows
- Environment‑based secret management (`CLAUDE_API_KEY`)
- Experimental Dark Mode support (WIP) – feedback & contributions welcome

## Repository Structure (Relevant Parts)
```
api/                # Node/Express Claude analysis microservice
  package.json
  claude.js
complaints-active.html  # Page with AI triage panel
static/             # CSS/JS assets
README.md           # This file
```

## Prerequisites
| Component | Requirement |
|-----------|-------------|
| Node.js   | >= 18.x (LTS recommended; 20.x tested) |
| Claude API Key | Valid Anthropic API key with access to `claude-3-*` models |

On Linux/macOS you can confirm:
```
node -v
npm -v
```
If not installed, visit: https://nodejs.org/ (LTS) or use a package manager.

## Windows Setup Guide
Below are step-by-step instructions tailored for Windows (both Command Prompt and PowerShell examples included).

### 1. Install Node.js
Choose ONE method:
1. Download installer (Recommended):
   - Go to https://nodejs.org/en/download
   - Download the Windows (.msi) LTS installer
   - Run installer (ensure "Add to PATH" is checked)
2. Use winget (Windows 10/11):
   - Open PowerShell (Admin) and run:
     ```powershell
     winget install OpenJS.NodeJS.LTS
     ```
3. Use Chocolatey (if already installed):
   ```cmd
   choco install nodejs-lts
   ```

Verify installation:
```cmd
node -v
npm -v
```

### 2. Clone the Repository
If you haven't already:
```cmd
git clone <YOUR_REPO_URL>
cd company-portal
```

### 3. Create Environment File
Inside the `api` directory, create a file named `.env`:
```
CLAUDE_API_KEY=sk-your-real-key-here
PORT=3001
```
> Never commit real API keys. `.env` is ignored via `.gitignore`.

Alternatively, set an environment variable temporarily:
- Command Prompt:
  ```cmd
  set CLAUDE_API_KEY=sk-your-real-key-here
  ```
- PowerShell:
  ```powershell
  $env:CLAUDE_API_KEY="sk-your-real-key-here"
  ```

### 4. Install Dependencies & Start API Service
From repo root:
```cmd
cd api
npm install
npm start
```
Expected console output:
```
Claude analysis service listening on :3001
```

### 5. Verify Health Endpoint
In a separate terminal:
```cmd
curl http://localhost:3001/health
```
Should return JSON:
```json
{"ok":true,"service":"claude-complaint-analysis","hasKey":true}
```
If `hasKey` is false, re-check your environment variable or `.env` placement.

### 6. Open the Front-End
You can simply open `complaints-active.html` in a browser (double-click). 

However, for best results (avoiding any CORS quirks), serve files locally:

Option A – Using `npx serve` (installs on first use):
```cmd
npx serve ..  # Run from the api directory to serve project root
```
Option B – Simple Python server (if Python installed):
```cmd
python -m http.server 8080
```
Then navigate to: `http://localhost:8080/complaints-active.html`

### 7. Run an AI Analysis
On the `complaints-active.html` page:
1. Click the button: "Analyze visible complaints"
2. Wait for status text: `Received N analyses.`
3. Rows are outlined by priority & details appear in the AI panel.

## API Details
### Endpoint
`POST /analyze-complaints`

### Request Body
```json
{
  "complaints": [
    { "id": "160614-000000", "product": "Home mortgage", "issue": "Problems with the mortgage servicer when you are unable to pay", "consumer": "Name", "rawText": "Home mortgage - Problems with the mortgage servicer when you are unable to pay" }
  ]
}
```

### Response (Success)
```json
{
  "count": 1,
  "results": [
    {
      "id": "160614-000000",
      "priority": "urgent",
      "summary": "Servicer obstacles while borrower is delinquent risk foreclosure ...",
      "risk_score": 82,
      "issues": [
        {
          "text": "Problems with the mortgage servicer when you are unable to pay",
          "rationale": "Indicates potential servicing rule violations (Reg X loss mitigation handling).",
          "risk_category": "servicing"
        }
      ],
      "raw": { /* original AI element */ }
    }
  ]
}
```

### Common Priorities
| Priority | Meaning (Guideline) |
|----------|---------------------|
| urgent   | Potential regulatory exposure, consumer harm escalation, time-sensitive deadlines |
| medium   | Relevant compliance risk; needs review but not immediately critical |
| low      | Routine / low risk | 

## Environment & Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| CLAUDE_API_KEY | Anthropic key (required) | none |
| PORT | API service port | 3001 |

You can also override port at runtime:
```cmd
set PORT=5000 && npm start
```

## Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
| 500: CLAUDE_API_KEY not configured | Missing env var | Add to `.env` or set in shell |
| Unable to parse AI response | Model returned non-JSON | Retry; reduce complaint set size |
| ECONNREFUSED at fetch | API not running or wrong port | Start API, confirm port in console |
| CORS issues (rare on file://) | Browser security model | Use a local static server |
| hasKey: false in /health | `.env` not loaded | Ensure file named `.env` (no extension) |

## Security Notes
- Do NOT commit real keys. Rotate any exposed key in Anthropic dashboard.
- Consider adding request authentication (API token / session) if deploying.
- Set rate limits or complaint batch size restrictions for production.

## Extending
Ideas for follow-up enhancements:
- Add batching with progress UI
- Add priority filtering/sorting UI toggle
- Persist AI results client-side (localStorage) or server cache
- Add automated tests (e.g., Jest + Supertest for `/analyze-complaints`)
- Add Dockerfile for unified runtime

## Docker Usage
You can run the AI analysis service (and optionally serve the static portal) via Docker.

### Build Image
From the `api` directory:
```bash
docker build -t company-portal-ai .
```

Include static site inside container (allows `SERVE_STATIC=true` to serve HTML pages):
```bash
docker build --build-arg INCLUDE_STATIC=true -t company-portal-ai:with-static .
```

### Run (API Only)
```bash
docker run --rm -p 3001:3001 -e CLAUDE_API_KEY=sk-your-key company-portal-ai
```

### Run (API + Static Front-End)
```bash
docker run --rm -p 3001:3001 \
  -e CLAUDE_API_KEY=sk-your-key \
  -e SERVE_STATIC=true \
  -e STATIC_DIR=/workspace \
  company-portal-ai:with-static
```
Then open: http://localhost:3001/complaints-active.html

### Multi-Platform Build (Optional)
```bash
docker buildx build --platform linux/amd64,linux/arm64 -t yourrepo/company-portal-ai:latest .
```

### Clean Up
```bash
docker image prune -f
```

### Notes
- The container expects `CLAUDE_API_KEY`; without it `/analyze-complaints` returns 500.
- Healthcheck endpoint: `GET /health`.
- Adjust memory limits using Docker run flags if processing large batches.

## Quick Windows Command Recap
```cmd
:: From project root
cd api
copy NUL .env
notepad .env  (paste CLAUDE_API_KEY=...)
npm install
npm start
```
PowerShell equivalent:
```powershell
cd api
New-Item -Name .env -ItemType File
notepad .env   # add CLAUDE_API_KEY=...
npm install
npm start
```

## License / Usage
Internal prototype / demo. Add an explicit license file before distributing.

---
Questions or want automated tests / Docker support added? Open an issue or ask for the enhancement and we can implement it.
