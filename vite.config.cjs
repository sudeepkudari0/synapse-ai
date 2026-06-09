const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');
const path = require('path');

module.exports = defineConfig({
    plugins: [react.default()],
    base: './',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        strictPort: true,
        watch: {
            ignored: ['**/native/**']
        }
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true
    }
});
