# AGENTS.md
Guidelines and persistent rules for Codex and contributors.

---

# Deployment (GitHub Pages)
- Always keep the production version compatible with GitHub Pages.
- Deploy from the `main` branch.
- Keep site files in the repository root unless otherwise specified.
- Do not require server-side code.

---

# PWA and caching
- Always include a `manifest.webmanifest`.
- Always include a `sw.js` service worker.
- Always define a constant:

  const CACHE_VERSION = "v1";

- Increment CACHE_VERSION whenever any frontend file changes.
- Ensure service worker updates correctly and does not trap users on old versions.

---

# Mobile-first design
- Always design mobile-first.
- Optimize for touch interaction.
- Minimum touch target size: 44px.
- Ensure responsive layout for smartphone screens.
- Avoid hover-only interactions.

---

# UI / UX standards
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

# Performance
- Keep load time fast.
- Avoid heavy frameworks unless explicitly requested.
- Prefer vanilla HTML, CSS, and JavaScript.
- Target 60 fps for animations and games.
- Optimize for mid-range smartphones.

---

# Code structure
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

# Git workflow
- Never push directly to main unless explicitly requested.
- Always create a branch and open a Pull Request.
- Keep commits clear and descriptive.

---

# Safety and robustness
- Do not break existing features.
- Preserve backward compatibility.
- Test logic before committing.

---

# For games (if applicable)
- Must work with touch input.
- Maintain stable physics behavior.
- Avoid external dependencies unless necessary.
- Keep gameplay smooth on mobile devices.

---

# Default behavior
When unsure:
- choose the simplest robust solution
- maintain compatibility with GitHub Pages
- maintain mobile compatibility


## Skills
A skill is a set of local instructions to follow that is stored in a `SKILL.md` file. Below is the list of skills that can be used. Each entry includes a name, description, and file path so you can open the source for full instructions when using a specific skill.
### Available skills
- skill-creator: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Codex's capabilities with specialized knowledge, workflows, or tool integrations. (file: /opt/codex/skills/.system/skill-creator/SKILL.md)
- skill-installer: Install Codex skills into $CODEX_HOME/skills from a curated list or a GitHub repo path. Use when a user asks to list installable skills, install a curated skill, or install a skill from another repo (including private repos). (file: /opt/codex/skills/.system/skill-installer/SKILL.md)
### How to use skills
- Discovery: The list above is the skills available in this session (name + description + file path). Skill bodies live on disk at the listed paths.
- Trigger rules: If the user names a skill (with `$SkillName` or plain text) OR the task clearly matches a skill's description shown above, you must use that skill for that turn. Multiple mentions mean use them all. Do not carry skills across turns unless re-mentioned.
- Missing/blocked: If a named skill isn't in the list or the path can't be read, say so briefly and continue with the best fallback.
- How to use a skill (progressive disclosure):
  1) After deciding to use a skill, open its `SKILL.md`. Read only enough to follow the workflow.
  2) If `SKILL.md` points to extra folders such as `references/`, load only the specific files needed for the request; don't bulk-load everything.
  3) If `scripts/` exist, prefer running or patching them instead of retyping large code blocks.
  4) If `assets/` or templates exist, reuse them instead of recreating from scratch.
- Coordination and sequencing:
  - If multiple skills apply, choose the minimal set that covers the request and state the order you'll use them.
  - Announce which skill(s) you're using and why (one short line). If you skip an obvious skill, say why.
- Context hygiene:
  - Keep context small: summarize long sections instead of pasting them; only load extra files when needed.
  - Avoid deep reference-chasing: prefer opening only files directly linked from `SKILL.md` unless you're blocked.
  - When variants exist (frameworks, providers, domains), pick only the relevant reference file(s) and note that choice.
- Safety and fallback: If a skill can't be applied cleanly (missing files, unclear instructions), state the issue, pick the next-best approach, and continue.
