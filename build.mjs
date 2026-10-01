import {build} from 'esbuild';
import {cp, mkdir, writeFile} from 'node:fs/promises';
import {modernReadingMessages} from './src/modern-reading.mjs';

await mkdir(new URL('./dist/', import.meta.url), {recursive: true});
await cp(new URL('./public/', import.meta.url), new URL('./dist/', import.meta.url), {recursive: true});
await build({entryPoints: ['src/popup.ts', 'src/content.ts', 'src/background.ts'], bundle: true,
    outdir: 'dist', format: 'iife', target: 'chrome102', sourcemap: false});
for (const locale of ['en', 'de']) {
    const directory = new URL(`./dist/_locales/${locale}/`, import.meta.url);
    await mkdir(directory, {recursive: true});
    await writeFile(new URL('messages.json', directory), JSON.stringify({description: {message: modernReadingMessages[locale].description}}, null, 2));
}
