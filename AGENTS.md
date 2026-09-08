# La Terreta: instructions for Codex

## Communication

Write user-facing text in ASD-STE100 Simplified Technical English. Use simple,
brief, clear, and human language. Keep the game's English, Spanish, and Valencian
translations in their own languages.

## Project

La Terreta is a browser game built with TypeScript, Three.js, and Vite. The world
is a complete sphere. It includes walking, cycling, trams, boats, local activities,
characters, a travel book, and sound. Read README.md for commands and PROMPT.md
for the complete build brief. Check the source before you change behavior.

## Main files

- `src/main.ts`: startup, asset loading, renderer, and frame loop.
- `src/game.ts`: game state, controls, transport, activities, and saves.
- `src/world.ts`, `src/ground.ts`, `src/terrain.ts`: world and ground placement.
- `src/data.ts`: stable place IDs, routes, and saved data.
- `src/locomotion.ts`, `src/bike*.ts`, `src/boat-navigation.ts`: travel rules.
- `src/characters.ts`, `src/character-rig.ts`: character models and animation.
- `src/activity-catalogue.ts`, `src/activities.ts`, `src/travel-book.ts`: tasks and progress.
- `src/ui.ts`, `src/style.css`, `src/touch-controls.ts`: interface and touch input.
- `src/i18n.ts`, `src/translations.ts`: English, Spanish, and Valencian text.
- `src/game-music.ts`, `src/local-sound.ts`: sound state and mixing.
- `public/`: shipped models, textures, fonts, art, and audio.
- `assets/`: editable Blender sources. `scripts/`: builders and focused checks.

## Change rules

1. Make the smallest change that fixes the requested behavior. Use the existing
   system. Do not add a framework or a second state system for a small change.
2. Preserve sphere traversal at the poles and seam. Ground objects against the
   terrain and mesh bounds. Keep collision checks in the correct coordinate space.
3. Keep a safe exit from each activity and transport mode. Check keyboard and
   touch input when either can use the changed action.
4. Preserve saved IDs, browser storage keys, appearance, bike positions, memories,
   discoveries, and activity progress. Validate old saves when changing their format.
5. Keep the La Terreta name. Keep DONA and HOME unchanged in all languages. Do not
   restore the removed wave action. Translate new visible text in all three languages.
6. Keep audio off at startup. Preserve mute, pause, photo, globe, and hidden-tab
   behavior. Resume without duplicate audio sources.
7. Asset names, pivots, skeletons, and animation clips are runtime contracts. Check
   the loader and builder together before changing them. Preserve unrelated binary
   assets. Rebuild only the affected models.
8. Keep dependencies, fonts, and shipped media local at runtime. Do not place an
   API key in `public/`, source code, a build, or a commit. `.elevenlabs.txt` is a
   local input for optional audio generation only. Do not run paid generation
   unless the user requests it.
9. Put temporary renders and reports in ignored `output/`. Do not recreate old
   docs, reference folders, task ledgers, or review logs for routine changes.
10. Keep Blender and Python out of the Vercel build. Vercel builds with `npm ci`
    and `npm run build`, then serves `dist/`.

## Validation

Run `npm run build` after runtime or build changes. Run the relevant `check:*`
command from README.md. Use `npm run check` when the change affects several
systems or all asset checks. Do not add tests that only repeat the implementation.

For controls, camera, animation, sound, or layout changes, also exercise the
changed action in a real browser. Check the console, missing assets, entry,
exit, and recovery. Test mobile layouts when the change affects touch or layout.
Close browser sessions and servers that you start. Report what passed, what
failed, and what you did not check. A build does not prove an interaction works.

Keep the MIT license and the notices in `public/licenses/`.
