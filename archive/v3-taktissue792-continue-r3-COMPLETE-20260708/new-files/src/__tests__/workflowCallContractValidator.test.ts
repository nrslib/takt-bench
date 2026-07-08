import { describe, expect, it } from 'vitest';
import type { WorkflowConfig } from '../core/models/index.js';
import { validateWorkflowCallContracts } from '../infra/config/loaders/workflowCallContractValidator.js';
import {
  attachWorkflowSourcePath,
  attachWorkflowTrustInfo,
} from '../infra/config/loaders/workflowSourceMetadata.js';

function markBuiltinWorkflow(workflow: WorkflowConfig, sourcePath: string): WorkflowConfig {
  attachWorkflowSourcePath(workflow, sourcePath);
  attachWorkflowTrustInfo(workflow, {
    source: 'builtin',
    sourcePath,
    isProjectTrustRoot: false,
    isProjectWorkflowRoot: false,
  });
  return workflow;
}

describe('validateWorkflowCallContracts', () => {
  it('should validate unsupported child returns for builtin workflows', () => {
    const parent = markBuiltinWorkflow({
      name: 'builtin-parent',
      initialStep: 'delegate',
      maxSteps: 3,
      steps: [{
        name: 'delegate',
        kind: 'workflow_call',
        call: 'builtin-child',
        rules: [{ condition: 'retry_plan', next: 'COMPLETE' }],
      }],
    } as WorkflowConfig, '/builtins/en/workflows/builtin-parent.yaml');
    const child = markBuiltinWorkflow({
      name: 'builtin-child',
      subworkflow: {
        callable: true,
        returns: ['ok'],
      },
      initialStep: 'review',
      maxSteps: 3,
      steps: [{
        name: 'review',
        persona: 'reviewer',
        instruction: 'Review',
        rules: [{ condition: 'done', returnValue: 'ok' }],
      }],
    } as WorkflowConfig, '/builtins/en/workflows/builtin-child.yaml');

    expect(() => validateWorkflowCallContracts(parent, '/project', {
      isWorkflowPath: () => false,
      loadWorkflowByIdentifierForWorkflowCall: () => child,
    })).toThrow('workflow_call step "delegate" cannot route on unsupported child result "retry_plan"');
  });
});
