import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { addApproval, initPolicyFile, listApprovals } from "../src/policy-file.mjs";

test("policy file commands initialize, approve, and list approvals", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loam-policy-"));
  const policyPath = path.join(dir, ".loam", "policy.json");

  const init = initPolicyFile({ policyPath });
  assert.equal(init.created, true);
  assert.equal(fs.existsSync(policyPath), true);

  const duplicateInit = initPolicyFile({ policyPath });
  assert.equal(duplicateInit.created, false);

  const added = addApproval({
    policyPath,
    approval: {
      type: "capability",
      subject: "shell_exec",
      reason: "Local dev agent only",
      approved_by: "noor",
      expires: "2099-12-31"
    }
  });
  assert.equal(added.added, true);

  const duplicate = addApproval({
    policyPath,
    approval: {
      type: "capability",
      subject: "shell_exec",
      reason: "Same exception",
      approved_by: "noor",
      expires: "2099-12-31"
    }
  });
  assert.equal(duplicate.added, false);

  const approvals = listApprovals({ policyPath });
  assert.equal(approvals.active.length, 1);
  assert.equal(approvals.expired.length, 0);
  assert.equal(approvals.active[0].subject, "shell_exec");
});

test("policy file approvals normalize risk paths and separate expired entries", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loam-policy-"));
  const policyPath = path.join(dir, ".loam", "policy.json");
  initPolicyFile({ policyPath });

  addApproval({
    policyPath,
    approval: {
      type: "risk_path",
      subject: "web_access -> shell_exec",
      reason: "Reviewed sandbox",
      approved_by: "noor",
      expires: "2099-12-31"
    }
  });

  addApproval({
    policyPath,
    approval: {
      type: "mcp_server",
      subject: "mcp-shell",
      reason: "Expired fixture exception",
      approved_by: "noor",
      expires: "2000-01-01"
    }
  });

  const approvals = listApprovals({ policyPath });
  assert.equal(approvals.active.length, 1);
  assert.equal(approvals.expired.length, 1);
  assert.equal(approvals.active[0].subject, "web_access -> shell_exec");
  assert.equal(approvals.expired[0].subject, "mcp-shell");
});
