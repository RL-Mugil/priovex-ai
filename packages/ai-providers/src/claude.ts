import Anthropic from '@anthropic-ai/sdk';
import type {
  AIAnalysisInput,
  AIAnalysisOutput,
  PatentSummaryInput,
  ComparisonInput,
  ComparisonOutput,
  ConceptExtraction,
  KeywordStrategy,
  ScoredPatent,
} from '@priovex/types';
import type { AIProvider } from './interface';
import { withRetry } from './interface';
import {
  SYSTEM_PROMPT_PATENT_EXPERT,
  buildConceptExtractionPrompt,
  buildKeywordStrategyPrompt,
  buildPatentComparisonPrompt,
  buildFullReportPrompt,
} from './prompts';

const CLAUDE_MODEL = 'claude-opus-4-7-20251101';
const MAX_TOKENS = 8192;

export class ClaudeProvider implements AIProvider {
  readonly name = 'Anthropic Claude';
  readonly model = CLAUDE_MODEL;

  private client: Anthropic;
  private totalTokensUsed = 0;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  private async chat(userMessage: string): Promise<{ text: string; tokens: number }> {
    return withRetry(async () => {
      const response = await this.client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT_PATENT_EXPERT,
        messages: [{ role: 'user', content: userMessage }],
      });

      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as Anthropic.TextBlock).text)
        .join('');

      const tokens = response.usage.input_tokens + response.usage.output_tokens;
      this.totalTokensUsed += tokens;

      return { text, tokens };
    }, undefined, 'Claude chat');
  }

  private parseJSON<T>(text: string): T {
    // Strip markdown code blocks if present
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
      return JSON.parse(clean) as T;
    } catch {
      // Try to extract JSON from the text
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]) as T;
      throw new Error(`Failed to parse JSON from Claude response: ${clean.slice(0, 200)}`);
    }
  }

  async extractConcepts(
    inventionTitle: string,
    inventionDescription: string,
    technicalField: string,
    keyInnovations: string[]
  ): Promise<ConceptExtraction> {
    const prompt = buildConceptExtractionPrompt(
      inventionTitle, inventionDescription, technicalField, keyInnovations
    );
    const { text } = await this.chat(prompt);
    return this.parseJSON<ConceptExtraction>(text);
  }

  async buildKeywordStrategy(
    concepts: ConceptExtraction,
    technicalField: string
  ): Promise<KeywordStrategy> {
    const conceptsStr = JSON.stringify(concepts, null, 2);
    const prompt = buildKeywordStrategyPrompt(conceptsStr, technicalField);
    const { text } = await this.chat(prompt);
    return this.parseJSON<KeywordStrategy>(text);
  }

  async compareInventionToPatent(input: ComparisonInput): Promise<ComparisonOutput> {
    const prompt = buildPatentComparisonPrompt(
      input.inventionDescription,
      input.patent.title,
      input.patent.abstract,
      input.patent.claims
    );
    const { text } = await this.chat(prompt);
    return this.parseJSON<ComparisonOutput>(text);
  }

  async summarizePatent(input: PatentSummaryInput): Promise<string> {
    const { text } = await this.chat(
      `Summarize this patent in 2-3 sentences for a prior art search context:\n\nTitle: ${input.title}\nAbstract: ${input.abstract}`
    );
    return text.trim();
  }

  async generateFullReport(input: AIAnalysisInput): Promise<AIAnalysisOutput> {
    // First score each patent
    const scoredPatents: ScoredPatent[] = [];
    let totalTokens = 0;

    // Process top 20 candidates in parallel batches of 5
    const batchSize = 5;
    const candidates = input.candidatePatents.slice(0, 20);

    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((p) =>
          this.compareInventionToPatent({
            inventionDescription: `${input.inventionTitle}: ${input.inventionDescription}`,
            patent: {
              publicationNumber: p.publicationNumber,
              title: p.title,
              abstract: p.abstract,
              claims: p.claims,
            },
          })
        )
      );

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          const patent = batch[idx];
          scoredPatents.push({
            ...patent,
            ...result.value,
            rank: scoredPatents.length + 1,
          });
        }
      });
    }

    // Sort by relevance
    scoredPatents.sort((a, b) => b.similarityScore - a.similarityScore);
    scoredPatents.forEach((p, idx) => { p.rank = idx + 1; });

    // Generate full report
    const topPatentsStr = scoredPatents.slice(0, 10).map((p, i) =>
      `${i + 1}. ${p.publicationNumber} — "${p.title}" (Similarity: ${p.similarityScore}%)
   Assignee: ${p.assignees[0] || 'N/A'} | Filed: ${p.filingDate}
   Impact: ${p.noveltyImpact}
   Key similarity: ${p.similarities[0] || 'N/A'}`
    ).join('\n\n');

    const reportPrompt = buildFullReportPrompt(
      input.inventionTitle,
      input.inventionDescription,
      'Technology',
      [],
      topPatentsStr,
      input.reportStyle
    );

    const { text, tokens: reportTokens } = await this.chat(reportPrompt);
    totalTokens += reportTokens;

    const reportData = this.parseJSON<{
      executiveSummary: string;
      patentabilityAssessment: AIAnalysisOutput['patentabilityAssessment'];
      claimStrategy: AIAnalysisOutput['claimStrategy'];
    }>(text);

    const costUsd = (totalTokens / 1_000_000) * 15; // ~$15/M tokens for Opus

    return {
      executiveSummary: reportData.executiveSummary,
      scoredPatents,
      patentabilityAssessment: reportData.patentabilityAssessment,
      claimStrategy: reportData.claimStrategy,
      tokensUsed: totalTokens,
      costUsd,
      model: CLAUDE_MODEL,
      provider: 'claude',
    };
  }
}
