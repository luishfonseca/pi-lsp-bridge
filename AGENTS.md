# Releasing

This project uses [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs.

## Creating a changeset

After making changes, create a changeset to describe what changed and how it should be versioned.

### Option 1: Interactive CLI

```bash
npm run changeset
```

Follow the prompts to select the bump type (patch / minor / major) and write a summary.

### Option 2: Create the file manually

The CLI is interactive even with flags, so for tool/automated use, write the file directly:

```bash
cat > .changeset/my-change.md <<'EOF'
---
"pi-lsp-bridge": patch
---

Short description of the change
EOF
```

Valid bump types are `patch`, `minor`, or `major`.

## Commit

Commit the changeset along with your code:

```bash
git add .
git commit -m "..."
```

## Releasing

When ready to release, run:

```bash
npm run version   # bumps version, updates CHANGELOG.md, removes changesets
git add .
git commit -m "chore: release"
npm run release   # publishes to npm
```

Or all at once:

```bash
npm run version && git add . && git commit -m "chore: release" && npm run release
```

Changesets handles semver automatically based on the accumulated changeset bump types.

## Verify pending changesets

```bash
npx changeset status
```
