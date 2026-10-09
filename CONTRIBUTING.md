# Contributing

## Branches

| Branch | Role |
| --- | --- |
| `main` | Released code. Every merge into `main` is a release candidate. |
| `dev` | Integration branch. All work lands here first. |
| `feat/*`, `fix/*`, `chore/*`, `docs/*`, `refactor/*`, `test/*`, `ci/*` | Short-lived work branches, created from `dev`. |

`main` and `dev` are protected: no direct push, no force-push, no deletion. Every change goes through a pull request with green checks.

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) with a [gitmoji](https://gitmoji.dev/) shortcode:

```
<type>(<scope>)?: :gitmoji: <subject>
```

```
feat(auth): :sparkles: add two-factor login
fix: :bug: load incident relations
test(reservations): :test_tube: cover booking conflicts
ci: :green_heart: add commit lint
```

- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- The scope is optional and lower-case.
- The header is 100 characters at most and has no trailing period.
- A breaking change adds `!` after the type or scope and a `BREAKING CHANGE:` footer.
- Commit messages carry no tool or assistant attribution.

The format is checked locally by a `commit-msg` hook (installed by `npm install`) and on every pull request.

## Pull requests

- Work branches target `dev` and are **squash-merged**: the pull request title becomes the commit message, so it follows the commit convention.
- `dev` is merged into `main` with a **merge commit** to keep both histories aligned.
- Fill in the pull request template.

## Releases

Releases are automated with [release-please](https://github.com/googleapis/release-please):

1. Merging `dev` into `main` opens or updates a release pull request with the next version and the changelog.
2. Merging that release pull request creates the tag (`2.2.0`, no `v` prefix), updates `CHANGELOG.md` and publishes the GitHub release.
3. Merge `main` back into `dev` afterwards so the version bump and changelog reach `dev`.

Versions follow [Semantic Versioning](https://semver.org/): `fix` bumps the patch, `feat` the minor, a breaking change the major. Tags are never moved or deleted.

## Database schema

- In development the schema follows the entities automatically (`synchronize`).
- In production (`NODE_ENV=production`) the schema is only changed by migrations, which run at startup. `DB_SYNCHRONIZE=true` or `false` overrides either default.
- A change to an entity therefore needs a migration in the same pull request:

  ```
  npm run migration:generate --name=AddAircraftColour
  ```

  The command compares the entities with the database in `DATABASE_URL`, so run it against a database that is up to date with `dev`.
- The first migration, `InitialSchema`, is skipped on databases that already had the schema before migrations were introduced.
