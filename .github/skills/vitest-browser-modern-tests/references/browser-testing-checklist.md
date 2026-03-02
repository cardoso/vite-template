# Browser Testing Checklist

Use this checklist when generating or reviewing tests.

## Setup
- `vitest` and one browser provider package are installed.
- `test.browser.enabled` is `true`.
- `test.browser.provider` is configured.
- `test.browser.instances` has at least one browser.

## Authoring
- Prefer `page.getByRole` and `page.getByLabelText`.
- Use `expect.element` for async-safe assertions.
- Use locator actions (`.click`, `.fill`, `.selectOptions`) before lower-level APIs.
- Keep one user behavior per test.

## Reliability
- Avoid fixed timeouts and sleeps.
- Avoid fragile selectors and DOM-structure assertions.
- Keep mocks minimal; prefer realistic browser interactions.

## Accessibility
- Validate roles, labels, and visible states where relevant.
- Ensure interactions represent user pathways.

## Optional Visual Checks
- Use `toMatchScreenshot` only for stable UI surfaces.
- Configure comparator options explicitly.

## Validation
- Verify watch-mode pass for local feedback.
- Verify headless pass for CI parity.
