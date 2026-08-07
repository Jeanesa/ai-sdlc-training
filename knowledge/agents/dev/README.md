# knowledge/agents/dev/

Developer-role agents for the Meridian LMS.

| Agent | Purpose | Best used for |
|---|---|---|
| unit-test-reviewer.md | Reviews test files against the test quality bar (AC coverage, false-green detection, mocking, isolation, naming). Read-only. | After writing a task's tests, before committing — especially RLS/auth tests where false-green is a real risk. |