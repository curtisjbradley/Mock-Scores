import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'testing'] },
  tseslint.configs.recommended,
)
