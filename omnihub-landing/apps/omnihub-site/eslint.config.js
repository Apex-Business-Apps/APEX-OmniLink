import { createEslintConfig } from '../../../eslint.config.shared.js';

export default createEslintConfig({
  ignores: ['dist', 'node_modules']
});
