// Claude AI integration for complaint analysis (ESM-compatible)
// SECURITY NOTE: Do NOT hardcode API keys. Set CLAUDE_API_KEY in your environment.

import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY; // Must be provided at runtime

if (!CLAUDE_API_KEY) {
  console.warn('[WARN] CLAUDE_API_KEY is not set. /analyze-complaints endpoint will return 500 until configured.');
}

// Enable CORS for cross-origin requests (e.g., when HTML is served on different port)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(bodyParser.json({ limit: '1mb' }));

// Optional static file serving (so Docker can host the HTML demo as well)
// Set SERVE_STATIC=true to enable. Optionally override STATIC_DIR (default project root).
if (process.env.SERVE_STATIC === 'true') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, '..');
  const staticDir = path.resolve(process.env.STATIC_DIR || rootDir);
  console.log(`[INFO] Static file serving enabled at / (dir: ${staticDir})`);
  app.use(express.static(staticDir));
}

// Basic health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'claude-complaint-analysis', hasKey: !!CLAUDE_API_KEY });
});

// Utility: Extract first valid JSON (object or array) from a string
function extractJSON(text) {
  if (typeof text !== 'string') return null;
  const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/); // naive but usually fine
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    return null;
  }
}

// Normalize / validate AI output into expected schema
function normalizeResults(raw, originalComplaints) {
  if (!Array.isArray(raw)) return [];
  const allowedPriorities = ['urgent', 'medium', 'low'];
  return raw.map((item, idx) => {
    const base = originalComplaints[idx] || {};
    const priority = (item.priority || '').toString().toLowerCase();
    return {
      id: item.id || base.id || base.complaintId || `row-${idx}`,
      priority: allowedPriorities.includes(priority) ? priority : 'medium',
      summary: item.summary || '',
      risk_score: typeof item.risk_score === 'number' ? Math.min(100, Math.max(0, item.risk_score)) : null,
      issues: Array.isArray(item.issues) ? item.issues.slice(0, 10).map(issue => ({
        text: issue.text || '',
        rationale: issue.rationale || issue.reason || '',
        risk_category: issue.risk_category || issue.category || null
      })) : [],
      raw: item
    };
  });
}

// POST /analyze-complaints
app.post('/analyze-complaints', async (req, res) => {
  const { complaints } = req.body;
  if (!complaints || !Array.isArray(complaints) || complaints.length === 0) {
    return res.status(400).json({ error: 'Complaints (non-empty array) required.' });
  }
  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'CLAUDE_API_KEY not configured on server.' });
  }

  try {
    const limitedComplaints = complaints.slice(0, 50); // guard token usage
    const systemInstruction = `You are a compliance assistant specializing in CFPB consumer financial complaints.
Return ONLY valid JSON (no markdown, no commentary) as an array. Each element MUST have:
id (string), priority (urgent|medium|low), summary (string, <= 240 chars), risk_score (0-100 number), issues (array up to 10) where each issue has text, rationale, risk_category (one of: disclosure, fair-lending, udaa, servicing, data-accuracy, fees, collections, credit-reporting, other).
Prioritize 'urgent' if there are regulatory time sensitivity, potential consumer harm escalation, past due risk, or legal exposure.
If unsure, choose medium. Avoid hallucination—base findings ONLY on provided complaint text.`;

    const structuredExample = [{
      "id": "160614-000000",
      "priority": "urgent",
      "summary": "Servicer obstacles while borrower is delinquent risk foreclosure and missing loss mitigation timelines.",
      "risk_score": 82,
      "issues": [
        {"text": "Problems with the mortgage servicer when you are unable to pay", "rationale": "Indicates potential servicing rule violations (Reg X loss mitigation handling).", "risk_category": "servicing"}
      ]
    }];

    const promptObject = {
      system: systemInstruction,
      complaints: limitedComplaints
    };

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-opus-20240229',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: `Example format (DO NOT explain):\n${JSON.stringify(structuredExample, null, 2)}\n\nNow analyze these complaints:\n${JSON.stringify(promptObject, null, 2)}`
          }
        ],
        temperature: 0.2
      },
      {
        headers: {
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 60000
      }
    );

    const rawText = response.data?.content?.[0]?.text || '';
    const parsed = extractJSON(rawText);
    const normalized = normalizeResults(parsed, limitedComplaints);
    if (!normalized.length) {
      return res.status(502).json({ error: 'Unable to parse AI response', raw: rawText.slice(0, 1000) });
    }
    res.json({ count: normalized.length, results: normalized });
  } catch (err) {
    console.error('AI analysis error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Analysis failed', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Claude analysis service listening on :${PORT}`);
});
