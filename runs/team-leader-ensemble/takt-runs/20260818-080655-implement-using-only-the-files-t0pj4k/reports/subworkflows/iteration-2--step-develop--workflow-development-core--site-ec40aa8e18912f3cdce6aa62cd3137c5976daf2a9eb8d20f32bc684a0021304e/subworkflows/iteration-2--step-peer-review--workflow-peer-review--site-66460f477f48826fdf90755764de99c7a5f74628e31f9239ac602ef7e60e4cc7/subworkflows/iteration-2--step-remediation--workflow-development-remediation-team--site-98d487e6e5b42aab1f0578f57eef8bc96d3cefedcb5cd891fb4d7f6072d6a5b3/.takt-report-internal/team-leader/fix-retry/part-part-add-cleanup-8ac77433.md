# part part-add-cleanup: addTask外側cleanupの現行API移行

- status: done
- provider: opencode
- model: ollama-cloud/nemotron-3-super
- durationMs: 262952
## content

Replaced fs.rmdirSync with fs.rmSync in the cleanup section of addTask() function.
