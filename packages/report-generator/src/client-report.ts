import type { PatentReport } from '@priovex/types';
import { getLegalDisclaimer } from './disclaimer';

export function generateClientReport(report: PatentReport): string {
  const date = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const verdict = report.patentabilityAssessment.overallVerdict;
  const score   = report.patentabilityAssessment.patentabilityScore;
  const novelty = report.patentabilityAssessment.noveltyRating;

  const novDesc: Record<string, string> = {
    HIGH: 'The invention demonstrates strong novelty — critical distinguishing features are absent from all prior art found.',
    'MEDIUM-HIGH': 'The invention demonstrates good novelty — key features are not directly found in prior art.',
    MEDIUM: 'The invention demonstrates moderate novelty — some features overlap with prior art but key combinations are novel.',
    'MEDIUM-LOW': 'The invention demonstrates limited novelty — several features are present individually in prior art.',
    LOW: 'The invention may face significant novelty challenges — core features appear in prior art.',
  };

  const verdictDesc: Record<string, string> = {
    PROCEED: 'We recommend proceeding with a patent application.',
    PROCEED_WITH_CAUTION: 'We recommend proceeding with a patent application, with careful claim drafting to navigate identified prior art.',
    REFINE_FIRST: 'We recommend refining the invention or claims strategy before filing.',
    UNLIKELY: 'The patentability prospects appear challenging given the prior art identified.',
  };

  // Novel points section
  const novelPoints = report.novelElements.length > 0
    ? report.novelElements
        .sort((a, b) => b.noveltyWeight - a.noveltyWeight)
        .map((e) => `- ${e.claimLanguage}`)
        .join('\n')
    : report.statistics.keywordsSearched.slice(0, 6).map((k) => `- ${k}`).join('\n');

  // Search methodology
  const databases = [
    'USPTO — full-text search across title, abstract, claims, and description of US granted patents and published applications',
    'EPO Espacenet — European and international patent publications',
    'WIPO PatentScope — PCT international applications',
    'Google Patents — aggregated global patent database',
    `BigQuery Patents Database — ${report.statistics.totalPatentsReviewed.toLocaleString()} patents reviewed`,
  ];

  if (report.statistics.nplSourcesSearched.length > 0) {
    databases.push(...report.statistics.nplSourcesSearched.map((s) => `${s} — non-patent literature`));
  }

  // Prior art analysis table
  const priorArtRows = [
    ...report.topPriorArt.slice(0, 8).map((p) => {
      const observation = p.similarities.length > 0
        ? `This reference discloses ${p.similarities[0]}. However, it does not specifically disclose ${p.differences[0] ?? 'the novel combination claimed'}.`
        : p.analysis;
      return `| **${p.publicationNumber}** | ${p.abstract.slice(0, 200)}... | ${observation} |`;
    }),
    ...report.nplReferences.slice(0, 4).map((n) => {
      const obs = n.analysis
        ? n.analysis
        : `This reference discusses ${n.title.slice(0, 80)} from a non-patent perspective. It does not disclose the claimed combination in a patentable form.`;
      return `| **${n.source.toUpperCase()}: ${n.title.slice(0, 60)}** | ${n.abstract.slice(0, 200)}... | ${obs} |`;
    }),
  ].join('\n');

  // Coverage summary
  let coverageSection = '';
  if (report.novelElements.length > 0 && report.coverageMatrix.elements.length > 0) {
    coverageSection = `
## Feature-by-Feature Coverage Analysis

| Novel Feature | Coverage Status | Prior Art Reference(s) |
|---------------|-----------------|------------------------|
${report.novelElements.slice(0, 10).map((e) => {
  const cells = report.coverageMatrix.cells[e.id] ?? {};
  const states = Object.values(cells).map((c) => c.state);
  const totalRefs = states.length;
  const notCovered = states.filter((s) => s === 'not_covered').length;
  const fullyCovered = states.filter((s) => s === 'fully_covered').length;
  const refIds = Object.keys(cells)
    .filter((k) => cells[k].state !== 'not_covered')
    .map((k) => {
      const ref = report.coverageMatrix.references.find((r) => r.id === k);
      return ref?.number ?? k;
    })
    .slice(0, 3)
    .join(', ');

  let status: string;
  if (totalRefs === 0 || notCovered === totalRefs) status = '✗ Not covered in any prior art';
  else if (fullyCovered === totalRefs) status = '✓ Covered in all references';
  else status = `~ Partially covered (${fullyCovered}/${totalRefs} references)`;

  return `| ${e.claimLanguage.slice(0, 80)}... | ${status} | ${refIds || 'None'} |`;
}).join('\n')}

**Legend:** ✓ = Covered | ~ = Partially covered | ✗ = Not covered
`;
  }

  // Claim strategy section
  let claimSection = '';
  if (report.gapClaimDraft.independentClaims.length > 0) {
    const ic = report.gapClaimDraft.independentClaims[0];
    const ic2 = report.gapClaimDraft.independentClaims[1];
    claimSection = `
### Recommended Independent Claim — ${ic.type.toUpperCase()} (Recommended)

**Rationale:** ${ic.rationale}

**Suggested Claim Language:**

> **Claim 1.** ${ic.text}

${ic2 ? `### Alternative Independent Claim — ${ic2.type.toUpperCase()}

**Rationale:** ${ic2.rationale}

> **Claim 1 (Alternative).** ${ic2.text}
` : ''}
### Dependent Claim Opportunities

The following specific features should be protected as dependent claims:

${report.gapClaimDraft.dependentClaimOpportunities.slice(0, 5).map((d) =>
  `- **${d.feature}** — ${d.basis}`
).join('\n')}

### Features to Narrow Around

${report.gapClaimDraft.narrowAroundGuidance.slice(0, 4).map((n) =>
  `- **${n.referenceNumber}** discloses *${n.overlappingElement}* — claim language should distinguish by: "${n.distinguishingFeature}"`
).join('\n')}

${report.gapClaimDraft.prosecutionNotes ? `**Prosecution Notes:** ${report.gapClaimDraft.prosecutionNotes}` : ''}
`;
  } else {
    claimSection = `
### Recommended Claim Strategy

**${report.claimStrategy.claimingApproach}**

> **Claim 1.** ${report.claimStrategy.independentClaimSuggestion}

**Key elements to emphasize:** ${report.claimStrategy.elementsToEmphasize.join(', ')}

**Prosecution strategy:** ${report.claimStrategy.prosecutionStrategy}
`;
  }

  // Examiner simulation section
  const examinerSection = report.examinerPrediction.firstOfficeActionScenario
    ? `
## Likely Office Action Scenario

Based on the prior art identified, the following is the most probable first office action scenario:

**Predicted Basis:** ${report.examinerPrediction.firstOfficeActionScenario.rejectionBasis}

**Predicted References:** ${report.examinerPrediction.firstOfficeActionScenario.predictedReferences.join(', ')}

**Recommended Response:** ${report.examinerPrediction.firstOfficeActionScenario.responseStrategy}

**Estimated Allowance Probability:** ${report.examinerPrediction.firstOfficeActionScenario.estimatedAllowanceChance}%
`
    : '';

  // Observation / conclusion
  const uncoveredElements = report.novelElements
    .filter((e) => {
      const cells = report.coverageMatrix.cells?.[e.id] ?? {};
      const states = Object.values(cells).map((c) => c.state);
      return states.length === 0 || states.every((s) => s === 'not_covered');
    })
    .slice(0, 4)
    .map((e) => e.claimLanguage.slice(0, 80));

  const disclaimer = getLegalDisclaimer(report.statistics.jurisdictionsCovered);

  return `# SUPPLEMENTARY SEARCH REPORT

**${report.inventionTitle}**

**Date:** ${date}

**Prepared by:** PrioVex.AI Patent Intelligence Platform | mugilvannan@myipstrategy.com

**Search Type:** ${report.searchType?.toUpperCase().replace('_', ' ') ?? 'PATENTABILITY'}

**Patentability Score:** ${score}/100 | **Novelty:** ${novelty} | **Verdict:** ${verdict}

---

## Novel Points

The invention relates to ${report.inventionDescription.slice(0, 200)}.

Key novel features of the invention include:

${novelPoints}

---

## How the Search Was Conducted

The prior art search was conducted on ${date} using the following methodology:

**Databases Searched:**
${databases.map((d) => `- ${d}`).join('\n')}

**Search Terms Used:**
- Primary: ${report.keywordStrategy.primaryKeywords.slice(0, 8).join(', ')}
- Synonyms: ${report.keywordStrategy.synonyms.slice(0, 10).join(', ')}
${report.keywordStrategy.claimsTerms?.length ? `- Claims-specific: ${report.keywordStrategy.claimsTerms.slice(0, 6).join(', ')}` : ''}

**Classification Codes:** ${report.cpcCodesAnalyzed.slice(0, 8).map((c) => c.code).join(', ')}

**Total coverage:** ${report.statistics.totalPatentsReviewed.toLocaleString()} patents reviewed | ${report.statistics.nplReferencesFound} NPL references found | ${report.statistics.relevantPatentsFound} relevant references identified

---

## Prior Art Analysis

| S. No. | Prior Art / Title | Relevant Extract | Observation |
|--------|-------------------|------------------|-------------|
${priorArtRows || '| — | No highly relevant prior art found | — | — |'}

---
${coverageSection}

## Claim Strategy
${claimSection}

---
${examinerSection}

---

## Observation

The supplementary search was conducted across USPTO, EPO Espacenet, WIPO PatentScope, Google Patents, and ${report.statistics.nplSourcesSearched.length > 0 ? report.statistics.nplSourcesSearched.join(', ') + ' (non-patent literature)' : 'major patent databases'}. Overall, the identified prior art discloses ${report.patentabilityAssessment.obviousnessAnalysis.slice(0, 200)}.

However, from a patentability perspective, the prior art does not explicitly disclose several key features of the invention, including:

${uncoveredElements.length > 0
  ? uncoveredElements.map((e) => `- ${e}...`).join('\n')
  : report.patentabilityAssessment.whiteSpaceAreas.slice(0, 3).map((w) => `- ${w}`).join('\n')}

${novDesc[novelty] ?? ''}

${verdictDesc[verdict] ?? ''}

---

## Disclaimer

${disclaimer}

---

*This report has been prepared by PrioVex.AI for client communication purposes.*
*AI-assisted analysis reviewed by MyIPStrategy | mugilvannan@myipstrategy.com*
*Sources: USPTO, EPO Espacenet, WIPO PatentScope, BigQuery Patents, ${report.statistics.nplSourcesSearched.join(', ')}*
*This report does not constitute legal advice. Prior art searches are not exhaustive.*
`;
}
