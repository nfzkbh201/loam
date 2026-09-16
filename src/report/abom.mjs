import { redactTargetLabel } from "./research.mjs";

export function buildAbomExport(result) {
  return {
    tool: result.tool,
    version: result.version,
    exported_at: new Date().toISOString(),
    redacted: false,
    target: result.target,
    targets: result.targets || [],
    abom: result.abom
  };
}

export function buildRedactedAbomExport(result) {
  return {
    tool: result.tool,
    version: result.version,
    exported_at: new Date().toISOString(),
    redacted: true,
    target: result.targets?.length > 0 ? "known agent config locations" : "target",
    targets: (result.targets || []).map((target) => ({
      label: redactTargetLabel(target.label) || "target",
      summary: target.summary
    })),
    abom: {
      mcp_config_file_count: result.abom.mcp_config_files.length,
      mcp_server_count: result.abom.mcp_servers.length,
      agent_instruction_file_count: result.abom.agent_instructions.length,
      github_workflow_count: result.abom.github_workflows.length,
      env_file_count: result.abom.env_files.length,
      secret_like_env_key_count: result.abom.env_files.reduce((count, file) => count + file.secret_like_keys.length, 0),
      capabilities: result.abom.capabilities,
      mcp_servers: result.abom.mcp_servers.map((server) => ({
        target_label: redactTargetLabel(server.target_label) || null,
        capabilities: server.capabilities,
        path_count: server.paths.length,
        env_key_count: server.env_keys.length
      })),
      github_workflows: result.abom.github_workflows.map((workflow) => ({
        target_label: redactTargetLabel(workflow.target_label) || null,
        risk_signals: workflow.risk_signals
      })),
      agent_instructions: result.abom.agent_instructions.map((instruction) => ({
        target_label: redactTargetLabel(instruction.target_label) || null,
        capabilities: instruction.capabilities,
        risk_signals: instruction.risk_signals
      })),
      env_files: result.abom.env_files.map((file) => ({
        target_label: redactTargetLabel(file.target_label) || null,
        key_count: file.keys.length,
        secret_like_key_count: file.secret_like_keys.length
      }))
    }
  };
}
