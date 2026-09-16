export function printDiscoveryReport(results) {
  console.log("loam discovery report");
  console.log("");

  const existing = results.filter((result) => result.exists);
  console.log(`Found ${existing.length} existing target${existing.length === 1 ? "" : "s"} out of ${results.length} checked.`);
  console.log("");

  for (const result of results) {
    const mark = result.exists ? "FOUND" : "missing";
    console.log(`${mark} ${result.label}`);
    console.log(`  path: ${result.path}`);
    console.log(`  scan: loam scan "${result.scan_hint}"`);
  }
}
