export function buildSarifReport(result) {
  const rules = [];
  const seenRules = new Set();

  for (const finding of result.findings) {
    if (seenRules.has(finding.id)) {
      continue;
    }

    seenRules.add(finding.id);
    rules.push({
      id: finding.id,
      name: finding.title,
      shortDescription: {
        text: finding.title
      },
      fullDescription: {
        text: finding.why
      },
      help: {
        text: finding.fix
      },
      properties: {
        tags: ["ai-agent", "mcp", "loam"],
        precision: "medium",
        securitySeverity: severityToSecurityScore(finding.severity)
      }
    });
  }

  return {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "loam",
            rules
          }
        },
        results: result.findings.map((finding) => ({
          ruleId: finding.id,
          level: severityToSarifLevel(finding.severity),
          message: {
            text: `${finding.title}: ${finding.why} Recommended fix: ${finding.fix}`
          },
          locations: [findingLocation(finding)]
        }))
      }
    ]
  };
}

function findingLocation(finding) {
  const evidence = finding.evidence.find((item) => item.config_file || item.file) || {};
  const uri = evidence.config_file || evidence.file || ".";

  return {
    physicalLocation: {
      artifactLocation: {
        uri
      },
      region: {
        startLine: 1
      }
    }
  };
}

function severityToSarifLevel(severity) {
  if (severity === "critical" || severity === "high") {
    return "error";
  }

  if (severity === "medium") {
    return "warning";
  }

  return "note";
}

function severityToSecurityScore(severity) {
  return {
    critical: "9.0",
    high: "7.0",
    medium: "5.0",
    low: "2.0"
  }[severity] || "1.0";
}
