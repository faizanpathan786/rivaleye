import type { PainReportOutput } from "@rivaleye/shared";

export function reportToMarkdown(output: PainReportOutput, competitor?: string): string {
  const sections: string[] = [];

  if (competitor) sections.push(`# Competitor Pain Report: ${competitor}\n`);

  if (output.summary) sections.push(`## Summary\n\n${output.summary}`);

  if (output.painClusters?.length) {
    sections.push(
      `## Pain Clusters\n\n${output.painClusters
        .map((c, i) => `${i + 1}. **${c.title}**: ${c.description}`)
        .join("\n")}`,
    );
  }

  if (output.featureGaps?.length) {
    sections.push(`## Feature Gaps\n\n${output.featureGaps.map((g) => `- ${g}`).join("\n")}`);
  }

  if (output.pricingPain) {
    sections.push(`## Pricing Pain\n\n${output.pricingPain}`);
  }

  if (output.switchingSignals?.length) {
    sections.push(
      `## Switching Signals\n\n${output.switchingSignals.map((s) => `- ${s}`).join("\n")}`,
    );
  }

  if (output.voiceOfCustomer?.length) {
    sections.push(
      `## Voice of Customer\n\n${output.voiceOfCustomer.map((q) => `> ${q}`).join("\n\n")}`,
    );
  }

  if (output.competitorWeaknesses?.length) {
    sections.push(
      `## Competitor Weaknesses\n\n${output.competitorWeaknesses.map((w) => `- ${w}`).join("\n")}`,
    );
  }

  if (output.productOpportunities?.length) {
    sections.push(
      `## Product Opportunities\n\n${output.productOpportunities
        .map((o, i) => `${i + 1}. ${o}`)
        .join("\n")}`,
    );
  }

  if (output.positioningAngles?.length) {
    sections.push(
      `## Positioning Angles\n\n${output.positioningAngles
        .map((a, i) => `${i + 1}. ${a}`)
        .join("\n")}`,
    );
  }

  if (output.recommendedActions?.length) {
    sections.push(
      `## Recommended Actions\n\n${output.recommendedActions
        .map((a, i) => `${i + 1}. ${a}`)
        .join("\n")}`,
    );
  }

  return sections.join("\n\n").trimEnd();
}

export function downloadMarkdown(filename: string, markdown: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
