# AGENTS.md
Guidelines and mandatory rules for Codex and contributors.

---

## VERSIONING (MANDATORY)
All branches, pull requests, and commits must include a version number prefix.

Version format:
`vMAJOR.MINOR.PATCH – short description`

Examples:
- `v0.1.0 – initial prototype`
- `v0.2.0 – slope-based gravity system`
- `v0.3.0 – jump charge system`
- `v0.3.1 – gravity tuning`
- `v0.4.0 – airborne flip system`

Branch naming format:
`codex/vMAJOR.MINOR.PATCH-short-description`

Pull request title format:
`vMAJOR.MINOR.PATCH – short description`

Commit message format:
`vMAJOR.MINOR.PATCH short description`

### VERSION INCREMENT RULES

PATCH:
- small tuning
- bug fixes
- minor gameplay adjustments

MINOR:
- new gameplay mechanic
- new physics system
- new control system

MAJOR:
- stable public release

Never silently overwrite major gameplay behavior without a new version number.

---

## GAMEPLAY DEVELOPMENT PRIORITIES
Prioritize:
- gameplay feel
- smooth physics
- mobile usability
- clean and maintainable code

Always refine gameplay iteratively.

---

## MOBILE AND DEPLOYMENT RULES
- Maintain compatibility with GitHub Pages.
- Maintain landscape mobile compatibility.
- Ensure service worker cache version is updated when frontend behavior changes.

---

## Deployment (GitHub Pages)
- Always keep the production version compatible with GitHub Pages.
- Deploy from the `main` branch.
- Keep site files in the repository root unless otherwise specified.
- Do not require server-side code.

---

## PWA and caching
- Always include a `manifest.webmanifest`.
- Always include a `sw.js` service worker.
- Always define a constant:

  `const CACHE_VERSION = "v1";`

- Increment `CACHE_VERSION` whenever any frontend file changes.
- Ensure service worker updates correctly and does not trap users on old versions.

---

## Mobile-first design
- Always design mobile-first.
- Optimize for touch interaction.
- Minimum touch target size: 44px.
- Ensure responsive layout for smartphone screens.
- Avoid hover-only interactions.

---

## UI / UX standards
Use modern design conventions:
- clean layout
- rounded corners (12–16px)
- subtle shadows
- smooth animations (CSS transitions)
- readable typography
- minimal color palette
- avoid visual clutter

Preferred inspiration:
- Apple Human Interface Guidelines
- modern SaaS dashboards
- Material Design 3

---

## Performance
- Keep load time fast.
- Avoid heavy frameworks unless explicitly requested.
- Prefer vanilla HTML, CSS, and JavaScript.
- Target 60 fps for animations and games.
- Optimize for mid-range smartphones.

---

## Code structure
Default structure:

/
index.html
styles.css
app.js or game.js
manifest.webmanifest
sw.js
README.md
assets/ (optional)

Keep structure simple and maintainable.

---

## Git workflow
- Never push directly to `main` unless explicitly requested.
- Always create a branch and open a Pull Request.
- Keep commits clear and descriptive.
- When creating any new feature or refactor, always create a new versioned branch and pull request.

---

## Safety and robustness
- Do not break existing features.
- Preserve backward compatibility.
- Test logic before committing.

---

## For games (if applicable)
- Must work with touch input.
- Maintain stable physics behavior.
- Avoid external dependencies unless necessary.
- Keep gameplay smooth on mobile devices.

---

## Default behavior
When unsure:
- choose the simplest robust solution
- maintain compatibility with GitHub Pages
- maintain mobile compatibility
