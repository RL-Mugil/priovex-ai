import type { PatentReport } from '@priovex/types';
import { marked } from 'marked';
import { format } from 'date-fns';
import { generateMarkdownReport } from './markdown';

export function generateHTMLReport(report: PatentReport): string {
  const markdown = generateMarkdownReport(report);
  const bodyHtml = marked(markdown);
  const date = format(new Date(report.generatedAt), 'MMMM d, yyyy');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prior Art Search Report — ${report.inventionTitle}</title>
  <style>
    :root {
      --primary: #1a56db;
      --primary-dark: #1341b5;
      --success: #057a55;
      --warning: #c27803;
      --danger: #c81e1e;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-700: #374151;
      --gray-900: #111827;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.6;
      color: var(--gray-900);
      background: white;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 60px;
    }

    .header {
      border-bottom: 3px solid var(--primary);
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    .header h1 {
      font-size: 24pt;
      color: var(--primary-dark);
      margin-bottom: 4px;
    }

    .header .meta {
      font-size: 10pt;
      color: #6b7280;
      font-family: 'Arial', sans-serif;
    }

    .logo {
      font-size: 14pt;
      font-weight: bold;
      color: var(--primary);
      font-family: 'Arial', sans-serif;
      letter-spacing: -0.5px;
    }

    h1 { font-size: 22pt; color: var(--primary-dark); margin: 30px 0 10px; }
    h2 { font-size: 16pt; color: var(--primary-dark); margin: 25px 0 10px; border-bottom: 1px solid var(--gray-200); padding-bottom: 5px; }
    h3 { font-size: 13pt; color: var(--gray-700); margin: 20px 0 8px; }
    h4 { font-size: 11pt; color: var(--gray-700); margin: 15px 0 5px; }

    p { margin: 8px 0; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 10pt;
      font-family: 'Arial', sans-serif;
    }

    th {
      background: var(--primary);
      color: white;
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
    }

    td {
      padding: 7px 12px;
      border-bottom: 1px solid var(--gray-200);
    }

    tr:nth-child(even) td { background: var(--gray-50); }

    .verdict-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 11pt;
      font-weight: bold;
      font-family: 'Arial', sans-serif;
    }

    .verdict-PROCEED { background: #d1fae5; color: var(--success); }
    .verdict-PROCEED_WITH_CAUTION { background: #fef3c7; color: var(--warning); }
    .verdict-REFINE_FIRST { background: #fef3c7; color: var(--warning); }
    .verdict-UNLIKELY { background: #fee2e2; color: var(--danger); }

    .patent-card {
      border: 1px solid var(--gray-200);
      border-left: 4px solid var(--primary);
      border-radius: 4px;
      padding: 16px 20px;
      margin: 15px 0;
      background: var(--gray-50);
    }

    .patent-number {
      font-family: 'Courier New', monospace;
      font-size: 10pt;
      background: var(--gray-200);
      padding: 2px 6px;
      border-radius: 3px;
    }

    .score-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 9pt;
      font-weight: 600;
      font-family: 'Arial', sans-serif;
    }

    .score-high { background: #fee2e2; color: #991b1b; }
    .score-moderate { background: #fef3c7; color: #92400e; }
    .score-low { background: #d1fae5; color: #065f46; }

    code {
      font-family: 'Courier New', monospace;
      background: var(--gray-100);
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 10pt;
    }

    pre {
      background: var(--gray-100);
      border: 1px solid var(--gray-200);
      border-radius: 4px;
      padding: 15px;
      font-family: 'Courier New', monospace;
      font-size: 10pt;
      line-height: 1.5;
      overflow-x: auto;
      white-space: pre-wrap;
    }

    ul, ol { margin: 8px 0 8px 20px; }
    li { margin: 4px 0; }

    blockquote {
      border-left: 3px solid var(--primary);
      padding-left: 15px;
      color: #6b7280;
      font-style: italic;
      margin: 10px 0;
    }

    hr { border: none; border-top: 1px solid var(--gray-200); margin: 25px 0; }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid var(--gray-200);
      font-size: 9pt;
      color: #9ca3af;
      font-family: 'Arial', sans-serif;
      text-align: center;
    }

    a { color: var(--primary); text-decoration: none; }
    a:hover { text-decoration: underline; }

    @media print {
      body { padding: 20px; }
      .patent-card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">PrioVex.AI</div>
    <h1 style="font-size:18pt; margin: 8px 0 4px;">Prior Art Search Report</h1>
    <p class="meta">
      Generated: ${date} &nbsp;·&nbsp;
      AI Provider: ${report.statistics.aiProvider.toUpperCase()} &nbsp;·&nbsp;
      Patents Reviewed: ${report.statistics.totalPatentsReviewed.toLocaleString()}
    </p>
  </div>

  ${bodyHtml}

  <div class="footer">
    <p>Generated by <strong>PrioVex.AI</strong> — AI-Powered Patent Prior Art Search Platform</p>
    <p>This report is for informational purposes only and does not constitute legal advice.</p>
    <p>Consult a registered patent attorney or agent before filing any patent application.</p>
  </div>
</body>
</html>`;
}
