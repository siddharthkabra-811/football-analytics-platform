# Project workflow

- Use strict TypeScript and Next.js App Router. Keep provider credentials server-side.
- Validate provider inputs at runtime and distinguish missing values from zero.
- Use PitchAPI as the sole provider. Document observed coverage and metric definitions before shipping analytics.
- Obtain approval for each page or significant scope change. Confirm data rights before public display of provider data.
- Use `development` for integration and `main` for explicitly approved releases. Verify changes before committing and use Conventional Commits.
