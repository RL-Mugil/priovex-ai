export const SYSTEM_PROMPT_PATENT_EXPERT = `You are a world-class patent attorney and technical expert with 30+ years of experience in USPTO prosecution, prior art searches, and patent strategy. You have deep expertise in:

- 35 USC 102 (novelty) and 35 USC 103 (obviousness) analysis
- CPC/IPC classification systems
- Patent claim drafting and prosecution strategy
- Technical fields: software, AI/ML, biotech, hardware, materials science, chemistry
- Inter partes review (IPR) and post-grant proceedings
- International patent prosecution (PCT, EPO)

When analyzing patents and inventions:
1. Be precise and evidence-based
2. Identify specific claim elements and technical features
3. Assess novelty and obviousness with legal rigor
4. Provide actionable, strategic recommendations
5. Use proper patent terminology
6. Structure output as valid JSON when requested

Your analysis must be:
- Accurate and legally sound
- Based on the specific patent evidence provided
- Professionally written for patent practitioners
- Appropriately nuanced (avoid absolute statements)`;

export function buildConceptExtractionPrompt(
  title: string,
  description: string,
  technicalField: string,
  keyInnovations: string[]
): string {
  return `Extract technical concepts and entities from this invention disclosure for patent prior art search.

INVENTION TITLE: ${title}
TECHNICAL FIELD: ${technicalField}
DESCRIPTION: ${description}
KEY INNOVATIONS:
${keyInnovations.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

Return a JSON object with this exact structure:
{
  "coreConceptss": ["concept1", "concept2"],
  "technicalEntities": ["entity1", "entity2"],
  "problemDomain": "description of the problem space",
  "solutionApproach": "description of the technical approach",
  "keyFeatures": ["feature1", "feature2"]
}

Be comprehensive. Include:
- Core technical concepts (algorithms, methods, processes)
- Physical/digital entities (components, systems, devices)
- The fundamental problem being solved
- The novel technical approach
- All key technical features to search for`;
}

export function buildKeywordStrategyPrompt(
  concepts: string,
  technicalField: string
): string {
  return `Generate a comprehensive keyword search strategy for patent prior art search.

TECHNICAL FIELD: ${technicalField}
EXTRACTED CONCEPTS: ${concepts}

Return a JSON object with this exact structure:
{
  "primaryKeywords": ["keyword1", "keyword2"],
  "synonyms": ["synonym1", "synonym2"],
  "adjacentTerms": ["term1", "term2"],
  "semanticVariants": ["variant1", "variant2"],
  "technicalTerms": ["tech_term1", "tech_term2"],
  "cpcHints": ["G06F", "H04L"],
  "searchQueries": ["query1 AND query2", "query3 OR query4"]
}

Rules:
- primaryKeywords: 5-10 core technical terms
- synonyms: industry alternatives for each primary keyword
- adjacentTerms: related but broader terms that may capture related art
- semanticVariants: different ways to express the same concept
- technicalTerms: highly specific technical nomenclature
- cpcHints: likely CPC classification sections (e.g., G06F, H04L, A61B)
- searchQueries: 8-12 BigQuery LIKE-compatible search strings`;
}

export function buildPatentComparisonPrompt(
  inventionDescription: string,
  patentTitle: string,
  patentAbstract: string,
  patentClaims?: string
): string {
  return `Compare this invention to a prior art patent and assess relevance.

INVENTION DESCRIPTION:
${inventionDescription}

PRIOR ART PATENT:
Title: ${patentTitle}
Abstract: ${patentAbstract}
${patentClaims ? `Claims (first 3):\n${patentClaims}` : ''}

Return a JSON object with this exact structure:
{
  "similarityScore": 75,
  "similarities": ["similarity1", "similarity2"],
  "differences": ["difference1", "difference2"],
  "noveltyImpact": "moderate",
  "analysis": "detailed analysis paragraph"
}

Rules:
- similarityScore: integer 0-100 (how similar this patent is to the invention)
- similarities: specific technical elements shared
- differences: specific technical elements that differ
- noveltyImpact: one of: "blocking" | "strong" | "moderate" | "weak" | "minimal"
  - blocking: patent reads on the invention, would prevent patenting
  - strong: highly relevant, claim scope must be carefully crafted
  - moderate: relevant, some elements overlap
  - weak: tangentially related
  - minimal: very little overlap
- analysis: 2-3 sentence professional analysis`;
}

export function buildFullReportPrompt(
  inventionTitle: string,
  inventionDescription: string,
  technicalField: string,
  keyInnovations: string[],
  topPatents: string,
  reportStyle: string
): string {
  const styleInstructions: Record<string, string> = {
    legal: 'Use formal legal language appropriate for patent attorneys. Reference 35 USC 102/103 specifically.',
    technical: 'Use technical engineering language. Focus on technical distinctions and implementations.',
    investor: 'Use business and investment language. Emphasize market opportunity and IP value.',
    concise: 'Be extremely concise. Use bullet points. Keep the report under 1000 words.',
    comprehensive: 'Provide exhaustive analysis. Include all details, risks, opportunities, and strategies.',
  };

  return `Generate a comprehensive patent prior art search report.

REPORT STYLE: ${reportStyle}
${styleInstructions[reportStyle] || styleInstructions.comprehensive}

INVENTION:
Title: ${inventionTitle}
Technical Field: ${technicalField}
Description: ${inventionDescription}
Key Innovations:
${keyInnovations.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

TOP PRIOR ART FOUND:
${topPatents}

Return a JSON object with this exact structure:
{
  "executiveSummary": "2-3 paragraph summary",
  "patentabilityAssessment": {
    "overallVerdict": "PROCEED",
    "noveltyRating": "HIGH",
    "noveltyAnalysis": "detailed novelty analysis",
    "obviousnessRating": "MEDIUM-HIGH",
    "obviousnessAnalysis": "detailed obviousness analysis under 35 USC 103",
    "patentabilityScore": 78,
    "keyRisks": ["risk1", "risk2"],
    "keyOpportunities": ["opportunity1", "opportunity2"],
    "whiteSpaceAreas": ["whitespace1", "whitespace2"],
    "recommendedClaimScope": "moderate"
  },
  "claimStrategy": {
    "independentClaimSuggestion": "A system/method for [invention] comprising: [element1]; [element2]; wherein [novel limitation].",
    "dependentClaimSuggestions": ["claim dep 1", "claim dep 2"],
    "claimingApproach": "description of approach",
    "elementsToEmphasize": ["element1", "element2"],
    "elementsToAvoid": ["avoid1", "avoid2"],
    "prosecutionStrategy": "prosecution strategy description"
  }
}

Verdict options: PROCEED | PROCEED_WITH_CAUTION | REFINE_FIRST | UNLIKELY
Rating options: HIGH | MEDIUM-HIGH | MEDIUM | MEDIUM-LOW | LOW
Claim scope: broad | moderate | narrow`;
}
