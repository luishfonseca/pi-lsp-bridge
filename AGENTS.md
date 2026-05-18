# Releasing

This project uses [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs.

## Workflow

1. **After making changes**, run:

   ```bash
   npm run changeset
   ```

   Select the bump type (patch / minor / major) and write a summary.
   This creates a `.changeset/*.md` file describing the change.

2. **Commit the changeset** along with your code:

   ```bash
   git add .
   git commit -m "..."
   ```

3. **When ready to release**, run:

   ```bash
   npm run version   # bumps version, updates changelog, removes changesets
   git add .
   git commit -m "chore: release"
   npm run release   # publishes to npm
   ```

   Or do it all at once:

   ```bash
   npm run version && git add . && git commit -m "chore: release" && npm run release
   ```

Changesets handles semver automatically based on the accumulated changeset bump types.
