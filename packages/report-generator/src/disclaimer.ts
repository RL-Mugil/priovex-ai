export function getLegalDisclaimer(jurisdictions: string[]): string {
  const hasUS = jurisdictions.includes('US');
  const hasEP = jurisdictions.includes('EP');
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

  parts.push(`The observations, analyses, and opinions expressed are for informational purposes only and are not to be construed as legal advice. Engage a registered patent attorney or agent for legal counsel.`);

  return parts.join('\n\n');
}
