import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['src/**/*.test.ts'],
		exclude: ['.claude/**', 'node_modules/**'],
		setupFiles: ['./src/lib/server/__mocks__/setup.ts']
	},
	resolve: {
		alias: {
			'$lib': '/src/lib',
			'$env/static/private': '/src/lib/server/__mocks__/env.ts'
		}
	}
});
