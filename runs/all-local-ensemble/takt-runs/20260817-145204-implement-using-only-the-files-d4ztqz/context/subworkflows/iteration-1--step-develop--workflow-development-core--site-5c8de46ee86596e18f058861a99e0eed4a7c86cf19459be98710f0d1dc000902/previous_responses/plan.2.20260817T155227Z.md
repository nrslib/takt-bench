I'll start by reading the task spec, plan knowledge, policy, and report directory to understand the current state.
Let me read the plan knowledge, policy, and check the report directory.
Let me read the existing plan and test report to understand the current state.
The test-report clearly indicates the previous plan was misaligned with the actual requirement. This is a replan step. Let me investigate the actual source code to build a correct plan.
Let me read the key source files: the github pr.ts, the add command, and the pipeline steps.
Let me read the attachments module, format.ts, pipeline steps, and git types.
Now let me look at the pipeline steps, git types, and the StoredImageAttachment type.
Let me look at the pipeline execute.ts and the imageAttachmentReferences utils, plus the git types.
Let me look at the git types, index exports, and the existing tests for add and pipeline.
Let me look at the GitHubProvider and existing tests to understand conventions.
Let me examine the existing tests for add, pipeline, and image attachments to understand conventions.
Let me look at the pipeline execution test and how executeTask handles attachments.
Let me look at the executeTask signature and how attachments flow through it, plus the pipeline index.
Let me look at how `executeTask` handles attachments in taskExecution.ts.
Let me look at the `executeTask` signature and how the pipeline could pass attachments.
Let me look at the `ExecuteTaskOptions` type and the existing image attachment tests.
Let me check the git status and the internal report directory for prior findings.
Let me examine how `executeTask` handles taskSpec and attachments in the direct path, and check the resolveTask flow.
Let me read the taskExecution.ts around the taskSpec handling and the workflowExecution.ts.
Let me check the tasks index exports and how `executeTask` handles a direct task (no task record).
Let me look at how `executeTask` handles a direct string task (no task record) in the pipeline path.
Let me look at workflowExecution.ts to understand the direct task path.
Let me check `workflowExecutionApi.ts` and how `executeTask` handles attachments in the direct path.
Let me look at the taskSpecContext and the enqueueService to understand the task spec preparation.
Let me look at the routing.ts and routing-inputs.ts to understand the pipeline `--pr` path.
Let me look at the github-pr test and git-format test to understand test conventions.
Let me look at `taskWorkflowExecution.ts` to understand the direct task path used by the pipeline.
Let me look at the git-format test and the it-pipeline test to understand conventions.