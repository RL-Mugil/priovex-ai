export const SYSTEM_PROMPT_PATENT_EXPERT = `You are a world-class patent attorney and technical expert with 30+ years of experience in USPTO prosecution, prior art searches, and patent strategy. You have deep expertise in:

- 35 USC 102 (novelty) and 35 USC 103 (obviousness) analysis
- CPC/IPC classification systems
- Patent claim drafting and prosecution strategy
- Technical fields: software, AI/ML, biotech, hardware, materials science, chemistry
- Inter partes review (IPR) and post-grant proceedings
- International patent prosecution (PCT, EPO)
- Non-patent literature (NPL) analysis for IDS and 103 combinations
- Examiner simulation and office action prediction

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

// =============================================================================
// STEP 1 — CONCEPT EXTRACTION
// =============================================================================

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
  "coreConcepts": ["concept1", "concept2"],
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

// =============================================================================
// STEP 2 — NOVEL ELEMENT DECOMPOSITION (new)
// =============================================================================

export function buildNovelElementDecompositionPrompt(
  title: string,
  description: string,
  technicalField: string,
  problemSolved: string,
  keyInnovations: string[],
  claimsDraft?: string
): string {
  return `Decompose this invention into structured claim-like novel elements for a comprehensive patent prior art search.

INVENTION TITLE: ${title}
TECHNICAL FIELD: ${technicalField}
PROBLEM SOLVED: ${problemSolved}
DESCRIPTION: ${description}
KEY INNOVATIONS:
${keyInnovations.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}
${claimsDraft ? `DRAFT CLAIMS:\n${claimsDraft}` : ''}

Return a JSON object with this exact structure:
{
  "elements": [
    {
      "id": "elem_a",
      "label": "a",
      "component": "name of the component or step",
      "function": "what it does",
      "technicalPurpose": "why it matters technically",
      "interaction": "how it interacts with other elements",
      "noveltyWeight": 85,
      "searchKeywords": ["keyword1", "keyword2"],
      "cpcMapping": ["G06F21/31", "H04L9/08"],
      "claimLanguage": "A [component] configured to [function] whereby [outcome]."
    }
  ],
  "systemClaimDraft": "A system for [core function] comprising: a [element a]; a [element b]; wherein [key relationship].",
  "methodClaimDraft": "A computer-implemented method for [function] comprising: [step 1]; [step 2]; wherein [key outcome].",
  "searchConcepts": [
    { "concept": "element a phrase", "keywords": ["syn1", "syn2", "syn3"] }
  ]
}

Rules:
- Generate 6–15 elements covering all technically novel aspects
- noveltyWeight: 0–100 (100 = highly novel, 0 = known art)
- claimLanguage must be in patent claim format: "A [X] configured to [Y]..." or "A step of [action] whereby [outcome]..."
- cpcMapping: specific CPC codes relevant to each element
- searchKeywords: 3–6 terms to search in BigQuery/NPL databases for this specific element
- Label elements a, b, c... in order of decreasing novelty weight`;
}

// =============================================================================
// STEP 3 — KEYWORD STRATEGY
// =============================================================================

export function buildKeywordStrategyPrompt(
  concepts: string,
  technicalField: string
): string {
  return `Generate a comprehensive keyword search strategy for patent and non-patent literature prior art search.

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
  "searchQueries": ["query1 AND query2", "query3 OR query4"],
  "nplQueries": ["academic query 1", "academic query 2"],
  "claimsTerms": ["functional claim term 1", "functional claim term 2"]
}

Rules:
- primaryKeywords: 5–10 core technical terms
- synonyms: industry alternatives for each primary keyword
- adjacentTerms: related but broader terms
- semanticVariants: different ways to express the same concept
- technicalTerms: highly specific technical nomenclature
- cpcHints: likely CPC classification sections (e.g., G06F21, H04L9)
- searchQueries: 8–12 BigQuery-compatible strings
- nplQueries: 4–6 academic-paper-optimized strings (use AND/OR, broader terms)
- claimsTerms: 4–6 functional terms likely found in patent claims`;
}

// =============================================================================
// STEP 4 — PATENT COMPARISON (element-aware)
// =============================================================================

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
- similarityScore: integer 0–100
- noveltyImpact: "blocking" | "strong" | "moderate" | "weak" | "minimal"
  - blocking: patent reads on the invention, would prevent patenting
  - strong: highly relevant, claim scope must be carefully crafted
  - moderate: relevant, some elements overlap
  - weak: tangentially related
  - minimal: very little overlap
- analysis: 2–3 sentence professional analysis`;
}

// =============================================================================
// STEP 5 — COVERAGE ANALYSIS (new — per reference, all elements)
// =============================================================================

export function buildCoverageAnalysisPrompt(
  inventionDescription: string,
  elements: Array<{ id: string; label: string; claimLanguage: string }>,
  reference: {
    id: string;
    number: string;
    title: string;
    abstract: string;
    claims?: string;
    type: 'patent' | 'npl';
  }
): string {
  const elementsStr = elements
    .map((e) => `[${e.id}] (${e.label}) ${e.claimLanguage}`)
    .join('\n');

  return `Analyze how a prior art reference covers each novel element of an invention.

INVENTION DESCRIPTION:
${inventionDescription}

NOVEL ELEMENTS (claim-like language):
${elementsStr}

PRIOR ART REFERENCE:
Type: ${reference.type}
Number: ${reference.number}
Title: ${reference.title}
Abstract: ${reference.abstract}
${reference.claims ? `Claims:\n${reference.claims}` : ''}

For each novel element, determine coverage in this reference. Return a JSON object:
{
  "referenceId": "${reference.id}",
  "cells": {
    "elem_a": {
      "state": "fully_covered",
      "reasoning": "why this element is covered",
      "confidenceScore": 85,
      "evidence": "direct quote or description from the reference",
      "claimCitation": "Claim 1, limitation b (optional)",
      "figureReferences": ["FIG. 3 (optional)"]
    },
    "elem_b": {
      "state": "not_covered",
      "reasoning": "why this element is absent",
      "confidenceScore": 90,
      "evidence": "No mention of [specific feature] in abstract or claims",
      "claimCitation": null,
      "figureReferences": []
    }
  }
}

Coverage states:
- "fully_covered": reference explicitly discloses this element
- "partially_covered": reference discloses part of the element but not all aspects
- "implied": element is implied by the reference but not explicitly stated
- "not_covered": element is absent from the reference
- "ambiguous": insufficient information to determine coverage

Analyze ALL ${elements.length} elements. Use exact element IDs as keys (elem_a, elem_b, etc.).`;
}

// =============================================================================
// STEP 5b — COVERAGE MATRIX BATCH (all references in one call)
// =============================================================================

export function buildCoverageMatrixBatchPrompt(
  inventionDescription: string,
  elements: Array<{ id: string; label: string; claimLanguage: string }>,
  references: Array<{
    id: string;
    number: string;
    title: string;
    abstract: string;
    claims?: string;
    type: 'patent' | 'npl';
  }>
): string {
  const elementsStr = elements
    .map((e) => `[${e.id}] (${e.label}) ${e.claimLanguage}`)
    .join('\n');

  const refsStr = references
    .map((r, i) =>
      `### ${i + 1}. ${r.number} (${r.type})\nTitle: ${r.title}\nAbstract: ${r.abstract.slice(0, 400)}${r.claims ? `\nClaims (excerpt): ${r.claims.slice(0, 500)}` : ''}`
    )
    .join('\n\n');

  const exampleElemId = elements[0]?.id ?? 'elem_a';
  const exampleRefId  = references[0]?.id ?? 'ref1';

  return `Analyze how each prior art reference covers each novel element of this invention.

INVENTION: ${inventionDescription}

NOVEL ELEMENTS:
${elementsStr}

PRIOR ART REFERENCES:
${refsStr}

Return a single JSON object with this exact structure:
{
  "${exampleElemId}": {
    "${exampleRefId}": {"state": "fully_covered", "reasoning": "explicit disclosure in claim 1", "confidenceScore": 85},
    "ref2": {"state": "not_covered", "reasoning": "no mention of this feature", "confidenceScore": 90}
  },
  "elem_b": { ... }
}

Rules:
- Top-level keys = element IDs (${elements.map((e) => e.id).join(', ')})
- Second-level keys = reference IDs (${references.map((r) => r.id).join(', ')})
- State: "fully_covered" | "partially_covered" | "implied" | "not_covered" | "ambiguous"
- Cover ALL ${elements.length} elements × ALL ${references.length} references = ${elements.length * references.length} cells total
- Keep reasoning under 80 chars`;
}

// =============================================================================
// STEP 6 — NPL REFERENCE ANALYSIS (new)
// =============================================================================

export function buildNPLAnalysisPrompt(
  inventionDescription: string,
  nplTitle: string,
  nplAbstract: string,
  nplSource: string
): string {
  return `Analyze a non-patent literature (NPL) reference for prior art relevance.

INVENTION DESCRIPTION:
${inventionDescription}

NPL REFERENCE:
Source: ${nplSource}
Title: ${nplTitle}
Abstract: ${nplAbstract}

Return a JSON object:
{
  "similarityScore": 65,
  "similarities": ["specific technical feature shared"],
  "differences": ["specific technical feature absent"],
  "noveltyImpact": "moderate",
  "analysis": "2-3 sentence technical analysis for 35 USC 102/103",
  "anticipationRisk": 45,
  "obviousnessRisk": 60,
  "isSuitable103Combination": true,
  "disclosureNote": "why this must be disclosed in IDS"
}

Rules:
- anticipationRisk: 0–100 (probability this reference alone anticipates under 102)
- obviousnessRisk: 0–100 (probability this combined with other art supports 103)
- isSuitable103Combination: true if usable in combination with another reference`;
}

// =============================================================================
// STEP 7 — EXAMINER SIMULATION (new)
// =============================================================================

export function buildExaminerSimulationPrompt(
  inventionTitle: string,
  inventionDescription: string,
  technicalField: string,
  elements: Array<{ id: string; claimLanguage: string }>,
  topPatentNumbers: string[],
  topPatentTitles: string[],
  cpcCodes: string[]
): string {
  return `Simulate USPTO examiner behavior for this patent application.

INVENTION TITLE: ${inventionTitle}
TECHNICAL FIELD: ${technicalField}
DESCRIPTION: ${inventionDescription}

NOVEL CLAIM ELEMENTS:
${elements.map((e) => `- ${e.claimLanguage}`).join('\n')}

CLOSEST PRIOR ART FOUND:
${topPatentNumbers.map((n, i) => `${i + 1}. ${n} — "${topPatentTitles[i] ?? ''}"`).join('\n')}

CPC CODES IN THIS SPACE: ${cpcCodes.join(', ')}

Return a JSON object predicting examiner behavior:
{
  "likelyRejectionBasis": ["102(a)(1)", "103"],
  "predictedCitedReferences": ["US10123456", "US9876543"],
  "cpcClassesLikelySearched": ["G06F21/31", "H04L9/08"],
  "closestArtCluster": "Description of where the closest prior art lives technically",
  "likelyObjectionPathways": ["Claim 1 anticipated by US10123456", "Claims 2-5 obvious over US10123456 in view of US9876543"],
  "enablementRisks": ["Claim 3 may lack enablement for the AI model selection algorithm"],
  "section112Risks": ["'dynamically selecting' in claim 1 may be indefinite without further definition"],
  "firstOfficeActionScenario": {
    "predictedReferences": ["US10123456", "US9876543"],
    "rejectionBasis": "Claims 1-15 rejected under 35 USC 103 as obvious over US10123456 in view of US9876543",
    "mappedClaims": [1, 2, 3, 4, 5],
    "responseStrategy": "Amend claim 1 to emphasize [specific novel element] not shown in either reference",
    "estimatedAllowanceChance": 65
  },
  "examinersLikelySearch": "The examiner will likely search G06F21 (data processing security) and H04L9 (cryptographic protocols) using keywords [keyword1, keyword2]"
}`;
}

// =============================================================================
// STEP 8 — GAP-GROUNDED CLAIM DRAFTING (new)
// =============================================================================

export function buildGapGroundedClaimDraftingPrompt(
  inventionTitle: string,
  inventionDescription: string,
  technicalField: string,
  elements: Array<{ id: string; label: string; claimLanguage: string; noveltyWeight: number }>,
  coverageSummary: string,
  topPatents: string
): string {
  return `Generate prosecution-aware patent claims grounded in prior art coverage gaps.

INVENTION TITLE: ${inventionTitle}
TECHNICAL FIELD: ${technicalField}
DESCRIPTION: ${inventionDescription}

NOVEL ELEMENTS WITH COVERAGE:
${elements.map((e) => `[${e.label}] (novelty: ${e.noveltyWeight}%) ${e.claimLanguage}`).join('\n')}

COVERAGE GAPS IDENTIFIED:
${coverageSummary}

TOP PRIOR ART:
${topPatents}

Return a JSON object with prosecution-ready claims:
{
  "independentClaims": [
    {
      "number": 1,
      "text": "Full independent claim text — A system for [function] comprising: a [component] configured to [function]; a [component] configured to [function]; wherein [novel limitation not in any prior art].",
      "type": "system",
      "rationale": "Why this claim angle is the strongest based on prior art gaps",
      "gapBasis": "Which uncovered elements support this claim",
      "vulnerabilities": ["Known prior art risk 1", "Known prior art risk 2"]
    },
    {
      "number": 2,
      "text": "A computer-implemented method for [function] comprising: [step]; [step]; wherein [gap-based limitation].",
      "type": "method",
      "rationale": "Alternative method claim angle",
      "gapBasis": "Gap in NPL and patent references for this method claim",
      "vulnerabilities": []
    }
  ],
  "dependentClaims": [
    {
      "number": 3,
      "text": "The system of claim 1, wherein [specific implementation detail not in prior art].",
      "type": "system",
      "rationale": "Protects specific novel implementation",
      "gapBasis": "No prior art discloses [specific detail]",
      "vulnerabilities": []
    }
  ],
  "narrowAroundGuidance": [
    {
      "referenceNumber": "US10123456",
      "overlappingElement": "The semantic indexing component",
      "distinguishingFeature": "dynamic model orchestration based on complexity thresholds",
      "suggestedLanguage": "wherein the orchestration engine dynamically selects among multiple language models based on semantic complexity thresholds"
    }
  ],
  "dependentClaimOpportunities": [
    {
      "feature": "Specific algorithm or data structure",
      "basis": "Novel, not in any prior art",
      "suggestedText": "The system of claim 1, wherein [specific feature]."
    }
  ],
  "prosecutionNotes": "Key prosecution strategy notes — what to emphasize during examination"
}`;
}

// =============================================================================
// STEP 9 — IDS ANALYSIS (new)
// =============================================================================

export function buildIDSAnalysisPrompt(
  inventionDescription: string,
  references: Array<{
    id: string;
    type: 'patent' | 'npl';
    number?: string;
    title: string;
    abstract: string;
    noveltyImpact?: string;
  }>
): string {
  const refsStr = references
    .map((r, i) =>
      `${i + 1}. [${r.type.toUpperCase()}] ${r.number ?? r.id}: "${r.title}"\n   Abstract: ${r.abstract.slice(0, 300)}...`
    )
    .join('\n\n');

  return `Generate IDS (Information Disclosure Statement) analysis for USPTO filing.

INVENTION DESCRIPTION:
${inventionDescription}

REFERENCES FOUND:
${refsStr}

For each reference, assess 35 USC 102/103 risk and examiner citation probability.
Return a JSON array:
[
  {
    "id": "${references[0]?.id ?? 'ref_1'}",
    "relevanceScore": 80,
    "risk102": 30,
    "risk103": 70,
    "examinerCitationProbability": 75,
    "disclosureReason": "Discloses [specific feature] relevant to claims 1-3 under 35 USC 103"
  }
]

Rules:
- risk102: probability the reference alone anticipates any claim element (0–100)
- risk103: probability the reference combined with others creates obviousness (0–100)
- examinerCitationProbability: how likely the examiner independently finds and cites this (0–100)
- disclosureReason: specific, legally-grounded reason for IDS disclosure
- Include ALL ${references.length} references in the output array`;
}

// =============================================================================
// STEP 10 — FULL REPORT
// =============================================================================

export function buildFullReportPrompt(
  inventionTitle: string,
  inventionDescription: string,
  technicalField: string,
  keyInnovations: string[],
  topPatents: string,
  reportStyle: string,
  nplSummary?: string,
  coverageSummary?: string
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
${styleInstructions[reportStyle] ?? styleInstructions.comprehensive}

INVENTION:
Title: ${inventionTitle}
Technical Field: ${technicalField}
Description: ${inventionDescription}
Key Innovations:
${keyInnovations.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

TOP PRIOR ART FOUND:
${topPatents}

${nplSummary ? `NON-PATENT LITERATURE SUMMARY:\n${nplSummary}` : ''}

${coverageSummary ? `COVERAGE ANALYSIS SUMMARY:\n${coverageSummary}` : ''}

Return a JSON object:
{
  "executiveSummary": "2-3 paragraph summary including NPL findings and coverage gaps",
  "patentabilityAssessment": {
    "overallVerdict": "PROCEED",
    "noveltyRating": "HIGH",
    "noveltyAnalysis": "detailed novelty analysis referencing specific elements",
    "obviousnessRating": "MEDIUM-HIGH",
    "obviousnessAnalysis": "detailed obviousness analysis under 35 USC 103 including NPL 103 combinations",
    "patentabilityScore": 78,
    "keyRisks": ["risk1", "risk2"],
    "keyOpportunities": ["opportunity1", "opportunity2"],
    "whiteSpaceAreas": ["whitespace1", "whitespace2"],
    "recommendedClaimScope": "moderate",
    "featureCoverageObservations": ["Element a is not found in any prior art", "Element b is partially covered by US10123456"]
  },
  "claimStrategy": {
    "independentClaimSuggestion": "A system/method for [invention] comprising: [element1]; [element2]; wherein [novel gap-based limitation].",
    "dependentClaimSuggestions": ["claim dep 1 — targeting uncovered element", "claim dep 2"],
    "claimingApproach": "description of approach based on coverage gaps",
    "elementsToEmphasize": ["element1", "element2"],
    "elementsToAvoid": ["avoid1 — covered by US12345"],
    "prosecutionStrategy": "prosecution strategy description"
  }
}

Verdict options: PROCEED | PROCEED_WITH_CAUTION | REFINE_FIRST | UNLIKELY
Rating options: HIGH | MEDIUM-HIGH | MEDIUM | MEDIUM-LOW | LOW
Claim scope: broad | moderate | narrow`;
}

// =============================================================================
// LEGAL DISCLAIMER (static, jurisdiction-aware)
// =============================================================================

export function getLegalDisclaimer(jurisdictions: string[]): string {
  const hasUS = jurisdictions.includes('US');
  const hasEP = jurisdictions.includes('EP');
  const hasIN = jurisdictions.some((j) => j === 'IN');
  const hasWO = jurisdictions.includes('WO');

  const parts: string[] = [
    `The sample of patents and non-patent literature included in this search report represents a sample uncovered within the constraints of time and available databases. It is not to be construed that there are no other existing prior art references that would be of relevance within the domain spanned by this search.`,
    `A search conducted using patent classification codes can miss relevant patents due to misfiling or improper classification. Keyword searches using electronic databases can miss publications using unusual or company-specific terminology.`,
    `This report was prepared with AI-assisted analysis. All AI-generated assessments represent probabilistic analysis and should be reviewed by a qualified patent professional before reliance.`,
    `Prior art searches are not exhaustive. A granted patent in any jurisdiction may still face invalidity challenges based on prior art not discovered in this search.`,
    `Publication delays of 18 months mean that patent applications filed within 18 months of the search date may not appear in any database searched.`,
  ];

  if (hasUS) {
    parts.push(`USPTO: This search does not constitute a freedom-to-operate opinion under 35 USC and does not assess design-around options. Applicants must conduct their own assessment of materiality under 37 CFR 1.56 before filing an Information Disclosure Statement.`);
  }

  if (hasEP) {
    parts.push(`EPO: This search does not replace the European Search Report issued by the EPO under Rule 61 EPC. No opinion is expressed regarding patentability under EPC Articles 52–57.`);
  }

  if (hasWO) {
    parts.push(`PCT: This search does not replace the International Search Report issued by an International Searching Authority under PCT Article 18.`);
  }

  if (hasIN) {
    parts.push(`India: This search does not constitute an opinion under the Patents Act 1970 (India) and does not address Section 3 exclusions.`);
  }

  parts.push(`The observations, analyses, and opinions expressed are for informational purposes only and are not to be construed as legal advice. Engage a registered patent attorney or agent for legal counsel.`);

  return parts.join('\n\n');
}
