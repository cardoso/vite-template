---
name: vitest-browser-modern-tests
description: 'Generate modern browser tests with Vitest Browser Mode, locator-first queries, and resilient assertions. Use when creating or refactoring frontend tests, adding browser mode config, or improving flaky UI tests in Vite projects.'
argument-hint: 'Feature or component to test, framework (if any), and expected user behaviors'
user-invocable: true
---

# Vitest Browser Modern Tests

Generate high quality frontend tests that run in real browsers through Vitest Browser Mode.

## When to Use
- Add new browser tests for a UI feature.
- Migrate old DOM tests to modern locator-based tests.
- Reduce flaky frontend tests by using retriable assertions.
- Add or fix Vitest Browser Mode config in Vite projects.

## Inputs To Ask For
- Feature under test and user-visible behavior.
- Framework in use: vanilla, React, Vue, Svelte, or other.
- Preferred provider: `playwright`, `webdriverio`, or `preview`.
  - If not specified, default to `playwright`.
- Whether to include visual checks (screenshots) and CI headless setup.

## Procedure
1. Validate the baseline setup.
- Check `vitest` and one browser provider dependency.
- Ensure browser mode config exists with `browser.enabled`, `browser.provider`, and at least one `browser.instances` entry.
- If missing, add minimal working config first.

2. Choose the browser strategy.
- Default to `playwright` for local and CI reliability.
- Use `preview` only for quick local inspection.
- If CI is required, prefer headless browser instances.

3. Pick the test shape.
- For component frameworks, use a framework renderer (`vitest-browser-react`, `vitest-browser-vue`, `vitest-browser-svelte`) when available.
- For vanilla DOM, render or mount directly and interact through `page` locators.

4. Author tests with modern interaction patterns.
- Query by role/label/text before test IDs.
- Use locator actions (`click`, `fill`, `selectOptions`) or `userEvent` from `vitest/browser`.
- Use `expect.element(...)` for retriable assertions.
- Keep each test focused on observable behavior, not implementation details.

5. Add robustness and accessibility checks.
- Prefer accessible locators (`getByRole`, `getByLabelText`).
- Add meaningful assertions (`toBeVisible`, `toHaveTextContent`, `toBeDisabled`, `toHaveAccessibleName`) for user outcomes.
- Avoid brittle selectors and unnecessary snapshots.

6. Optional visual regression.
- Use `toMatchScreenshot` only when explicitly requested.
- Set explicit comparator options and update policy.

7. Verify and refine.
- Run tests in watch mode for fast iteration.
- Run headless mode for CI parity.
- Remove flaky timing assumptions and over-mocking.

## Decision Points
- Provider selection:
  - `playwright`: default for reliable interactions and CI when provider is unspecified.
  - `webdriverio`: use when team tooling already depends on it.
  - `preview`: local exploration only.
- Test file placement:
  - Follow existing project test naming and folder conventions.
  - Do not enforce a new naming convention unless the user asks.
- Query strategy:
  - Prefer role and label.
  - Use `getByTestId` only when semantic queries are not viable.
- Interaction strategy:
  - Use locator `.fill()` instead of `.type()` unless keyboard semantics are required.
  - Use `userEvent.keyboard` for special key combinations.

## Quality Gates
- Browser mode config is valid and runnable.
- Tests assert user-visible outcomes, not internal state.
- Assertions are retriable where async UI changes are expected.
- Tests pass locally in watch and headless modes.
- New tests are readable, deterministic, and minimal.

## Output Contract
When invoked, produce:
1. Required config changes (if any).
2. New or updated test files.
3. A short rationale for locator and assertion choices.
4. Commands to run locally and in CI mode.

## Resources
- Modern checklist: [Browser Testing Checklist](./references/browser-testing-checklist.md)
- Starter template: [Browser Test Template](./assets/browser-test.template.ts)
