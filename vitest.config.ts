import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node'
	},
	resolve: {
		alias: {
			'$lib': '/src/lib',
			'$env/static/private': '/src/lib/server/__mocks__/env.ts'
		}
	}
});
