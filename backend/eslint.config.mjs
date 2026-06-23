import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  tseslint.configs.recommended,
  {
    files: ['testing/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
)
