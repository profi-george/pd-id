import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Изолированные копии репозитория для фоновых агентов (см. isolation:
    // "worktree") — у каждой свой node_modules/src/generated, попадание сюда
    // раздувает "npm run lint" тысячами предупреждений из чужого кода.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
