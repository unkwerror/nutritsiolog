import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        // Только исходники: без include dist/ подхватывал скомпилированные копии тестов
        include: ['src/**/*.test.ts'],
    },
})
