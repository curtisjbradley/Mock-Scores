# Frontend guidance

- This is a React 19 + React Router 7 + Vite TypeScript SPA.
- Keep components in their feature area (`organizer/`, `coach/`, `auth/`, and so on); put component CSS in a neighboring `styles/` directory.
- Use `react-hook-form` for all form state. Do not introduce uncontrolled inputs managed with `useState`.
- Lazy-load every page-level component with `React.lazy` and `Suspense`, following `App.tsx`.
- Use `react-router-dom` v7 for navigation; do not use `window.location`.
- `ProtectedRoute` gates organizer and coach routes. The scorer route (`/score/:scorerID`) is public and outside the main layout.
- The reusable standings editor/preview components live in `@mock-scores/standings-dsl/react`; do not recreate the removed legacy `organizer/blockly/` implementation.
