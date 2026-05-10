import OpenAI from 'openai';
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

const OPENAI_MODEL = 'gpt-4o';

export class OpenAIProvider implements AIProvider {
  readonly name = 'OpenAI GPT-4o';
  readonly model = OPENAI_MODEL;

  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  private async chat(userMessage: string): Promise<{ text: string; tokens: number }> {
    return withRetry(async () => {
      const response = await this.client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_PATENT_EXPERT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 8192,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const text = response.choices[0]?.message?.content ?? '';
      const tokens = response.usage?.total_tokens ?? 0;
      return { text, tokens };
    }, undefined, 'OpenAI chat');
  }

  private parseJSON<T>(text: string): T {
    try {
      return JSON.parse(text) as T;
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]) as T;
      throw new Error('Failed to parse OpenAI JSON response');
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
    const prompt = buildKeywordStrategyPrompt(JSON.stringify(concepts), technicalField);
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
    const response = await this.client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_PATENT_EXPERT },
        { role: 'user', content: `Summarize in 2-3 sentences:\nTitle: ${input.title}\nAbstract: ${input.abstract}` },
      ],
      max_tokens: 300,
      temperature: 0.2,
    });
    return response.choices[0]?.message?.content?.trim() ?? '';
  }

  async generateFullReport(input: AIAnalysisInput): Promise<AIAnalysisOutput> {
    const scoredPatents: ScoredPatent[] = [];
    let totalTokens = 0;

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

    scoredPatents.sort((a, b) => b.similarityScore - a.similarityScore);
    scoredPatents.forEach((p, idx) => { p.rank = idx + 1; });

    const topPatentsStr = scoredPatents.slice(0, 10).map((p, i) =>
      `${i + 1}. ${p.publicationNumber} — "${p.title}" (Similarity: ${p.similarityScore}%)
   Impact: ${p.noveltyImpact}`
    ).join('\n\n');

    const reportPrompt = buildFullReportPrompt(
      input.inventionTitle,
      input.inventionDescription,
      'Technology',
      [],
      topPatentsStr,
      input.reportStyle
    );

    const { text, tokens } = await this.chat(reportPrompt);
    totalTokens += tokens;

    const reportData = this.parseJSON<{
      executiveSummary: string;
      patentabilityAssessment: AIAnalysisOutput['patentabilityAssessment'];
      claimStrategy: AIAnalysisOutput['claimStrategy'];
    }>(text);

    const costUsd = (totalTokens / 1_000_000) * 5; // ~$5/M tokens for GPT-4o

    return {
      executiveSummary: reportData.executiveSummary,
      scoredPatents,
      patentabilityAssessment: reportData.patentabilityAssessment,
      claimStrategy: reportData.claimStrategy,
      tokensUsed: totalTokens,
      costUsd,
      model: OPENAI_MODEL,
      provider: 'openai',
    };
  }
}
