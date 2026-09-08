# Build La Terreta

These prompts describe how to build the game in this repository. They combine
the work into ordered steps. They are a build brief, not a copy of the original
conversation. Use the main prompt first, then complete each step in order. Keep
the result playable after each step. Check the current source when extending
this repository; the source and shipped assets define the current behavior.

## Main prompt: the complete product

Build **La Terreta**, a warm, detailed browser game about Valencia. Put the city
and its surrounding landscape on a complete small planet. Let the player walk
anywhere around it, cross both poles, cycle, ride a tram, and row a boat. Make
exploration calm and open. Use local life, sound, views, and small activities to
give the player reasons to explore.

Use TypeScript, Three.js, and Vite. Use original Blender geometry and editable
source files for the buildings, people, animals, plants, vehicles, and props.
Export GLB assets with stable names, pivots, materials, and animation clips.
Serve the game, fonts, images, models, and audio as static local files. Keep API
calls for optional asset generation outside the game. Prepare a static Vercel
build that needs no backend or secret.

Give the interface a Mediterranean character: warm paper, deep green text,
orange details, restrained blue water, DM Sans for controls, and Playfair Display
for display text. Keep the world visible. Use small, readable controls, clear
focus states, touch support, and English, Spanish, and Valencian translations.
Keep the product name La Terreta in every language.

Include two editable explorers named DONA and HOME, distinct residents, a
Fallas procession, 11 discoverable places, eight local activities, a travel
book, a map, first-person/follow/globe cameras, a selfie camera, saved progress,
a gradual afternoon-to-evening cycle, and original music with local sound.
Make movement, animation, object contact, and recovery believable. Each activity
and transport mode must have a clear exit.

## 1. Establish the app and full planet

Create a strict TypeScript Vite app. Separate startup, rendering, world layout,
terrain, ground queries, game state, controls, and UI. Use one frame loop with
bounded time steps. Load assets before play and show useful loading and failure
states. Dispose of resources when they are no longer needed.

Build a complete sphere, not a flat map with a curved edge. Define consistent
conversions between world coordinates, map coordinates, and the local tangent
frame. Movement must cross the seam and both poles without a jump, a camera
flip, or loss of control. Connect a full equatorial walking loop and a second
loop across the poles. Distribute the city, fields, woodland, coast, and lagoon
across the sphere. Orient buildings and people to the local ground normal.

Check a complete circuit and both pole crossings in the running game. Check
that the map and camera agree with the player's location.

## 2. Build Valencia and its landmarks

Create 11 places with stable IDs: Torres dels Serrans, Ciutat Vella, Plaça de
l’Ajuntament, Estació del Nord, Plaça de Bous, Ciutat de les Arts i les Ciències,
Aqua Multiespacio, El Saler · La Devesa, Universitat de València, L’Albufera, and
Jardí del Túria. Use recognizable shapes and details within an artistic layout.

Model Serrans with faceted towers, an arch, and three open rear galleries.
Build the cathedral and El Micalet. Give the civic plaza distinct town hall and
post office facades. Give the station its own roof, entrance, and facade rhythm.
Build the bullring with brick arcades, tiered seats, a sand floor, and two open
passages. Model Aqua with its glass form and supports.

Build the science campus as six separate recognizable forms: Hemisfèric,
Museu de les Ciències, Palau de les Arts, Umbracle, Àgora, and Oceanogràfic.
Use curved shells, ribs, white surfaces, blue glass, pools, and planted areas.
Add village streets, apartments, cafés, courtyards, orange trees, palms,
cypresses, street furniture, lamps, and paths between districts.

Use painted materials and a shared atlas where useful. Add detail to silhouettes,
openings, roofs, railings, and trim. Keep entrances and intended paths open in
the collision model. Place every solid object on the actual terrain using its
mesh bounds. Create lighter distant plant and building meshes for globe view.
Keep the source scenes editable and preserve third-party notices.

## 3. Make movement and cameras reliable

Implement camera-relative walking and running with gradual acceleration,
braking, and turning. Blend idle, walk, and run from actual speed. Drive step
phase from distance travelled. Keep feet on sloped ground. Let the player drag
the camera while moving to choose a new direction.

Provide first-person, follow, and full-globe views. Keep the horizon stable,
handle the full sphere, and prevent the follow camera from entering walls or
going below terrain. Allow follow-camera distance changes. In globe view, let
the player rotate the view freely. Avoid flicker, abrupt near-plane clipping,
or unstable camera height near buildings and water.

Support WASD and arrows, Shift to run, V to change view, F for first person,
mouse drag to look, and scroll to change distance. Add R to return safely to
Serrans. On touch screens, use a left joystick and independent look drag. Allow
two-finger zoom without leaving movement or look input stuck after release.
Check portrait and landscape layouts, touch cancellation, pause, and resume.

## 4. Add bicycles and the tram

Build a recognizable Valenbisi with separate wheel, steering, crank, pedal,
and stand pivots. Provide docks, nearby borrow prompts, and parking. Save parked
bike positions and identities. Mount only where both rider and bike fit. Avoid
placing a rider inside dock geometry, a wall, water, or another solid object.

Use forward input to pedal, left/right to steer, and reverse input to brake and
then move backward while held. Allow a reverse escape from a blocked position.
Use the same input behavior on the touch joystick. Keep tires on the ground,
hands on the grips, and soles on the pedals. Turn wheels with signed travel
distance; stop pedal motion when appropriate. Add a bell and fold the stand
while riding. Let the player park and return to walking safely.

Build a continuous six-stop tram route with a visible tram and stops. Support
boarding, riding, a requested exit at the next stop, and an immediate safe exit
while stopped. Move old rail-position saves to a safe stop exit. Keep the player,
tram, prompts, and camera states consistent through each transition.

## 5. Build Albufera and the coast

Create a broad irregular lagoon, reed islands, rice fields, a channel, sandy
coast, and wooded Devesa paths. Add a boardwalk, bridge, jetties, and six usable
boat docks. Create local birds, ducks, fish, reeds, and a traditional boat.
Give birds recognizable forms and motion. Keep their routes within suitable
habitat and clear of solid scenery.

Let the player board a boat, row forward, steer, slow down, and leave at any
valid dock. Check the whole hull against land and obstacles, including during
departure and docking. Give the rower a seated pose with hands that follow the
oars. Drive rowing animation, oar rotation, and water-entry sound from one phase.
Add a wake and water disturbance that follow actual motion.

Make beach waves move onto the sand and drain back. Use a shallow sloping bed,
visible water depth, foot ripples, and gradual walking resistance in water.
Keep boardwalks, the bridge, and jetties dry with normal travel speed. Do not
let the moving surface cause feet, boats, or the camera to jump.

## 6. Create explorers, residents, and animation

Build DONA and HOME as distinct stylized explorers with travel clothes, camera,
map pack, shoes, and orange-blossom details. Each home-screen choice must start
play directly. Provide an optional editor before play and during play.

Allow face and clothing changes, skin and eye colors, hair, freckles, accessories,
and the male explorer's hat. Save the choices. The face editor must provide a
close view. Use a clear smile for selfie poses. Keep blinking within the eye
region; do not move the face depth, glasses, or head while blinking.

Build a 24-identity character library: two explorers, twelve distinct residents,
two falleras, one fallero, and seven musician model types. Use varied resident
faces, heights, body shapes, colors, and clothing. Reuse musician types where
the procession needs more performers. Export detailed and distant skinned meshes.

Include Idle, Walk, Run, Cycle, March, Sit, Talk, Watch, Drink, Serve, Dance,
and OpenAwning clips, plus Row for the two explorers. This gives 290 clips.
Include Blink on detailed meshes and RelaxedHands morphs. Do not add a wave
button, key, action, or animation. Check skin weights, bone indices, finite
vertices, clip duration, foot contact, pedal contact, and grip position against
the exported GLB, not only against the Blender scene.

## 7. Add Fallas and street life

Build detailed original Fallas monuments in the civic plaza. Use colorful
figures, a clear vertical composition, decorated bases, and readable silhouettes.
Include the main Astra-themed monument. Keep its scale and base clearances
consistent with the walking area and selfie activity.

Create a moving procession with a Fallera Mayor, another fallera, two escorts,
and ten musicians. Add varied instruments, marching animation, and a route
through the city. Let the player watch, approach, join, and leave the band.
Make residents yield or react near the procession. Add watchers along its route.

Add café groups, shop activity, street carts, children with animated paper
firecrackers, and a bull in the arena. Let the bull stop near a visitor. Add a
ginger cat, pigeons with folded wings at rest and moving wings in flight, flowers,
and open terracotta pots with rims, inner walls, soil, and visible stems. Place
plants and animals without blocking paths or intersecting buildings and water.
Use deterministic placement where a stable layout is needed.

## 8. Add local moments and the changing day

Add optional moments: order horchata at the Serranos café, take a resident's
requested photo with both towers visible, sit at an Albufera bench, and join
the band. Show one clear nearby action. Give E and the touch Use button a
consistent cancel or exit behavior. Return to a safe standing position on reload.

Add three hidden places reached through an open gate, an orange-grove path,
and a roof ramp. Store their memories separately from the place journal.
Use sound, an opening in the scenery, or local activity to invite exploration.

Move afternoon to evening over 20 minutes of active play. Change sky, light,
lamps, and windows gradually. Stop the clock while paused or hidden and save
its state. Let movement help fade after five seconds of movement; make it
available through keyboard focus and Settings. Keep arrival titles brief.
Preserve action and exit prompts for as long as they are needed.

## 9. Implement activities and the travel book

Create a catalogue with stable activity IDs, targets, progress, and completion:

| Activity | Target |
| --- | --- |
| Pick oranges | Three distinct fruit IDs |
| Drink horchata | Eight seconds at the café |
| Throw a firecracker | One completed throw and ground pop |
| Row in Albufera | 20 metres across trips |
| March with the band | 10 seconds while joined |
| Ride a Valenbisi | 1,000 metres, including reverse travel |
| Pet the bull | Three seconds beside it |
| Selfie with the Falla | Saved image with player and monument in view |

Build picking, drinking, throwing, petting, and selfie props and poses. Count
progress from valid gameplay events. Keep partial progress between sessions.
Record each completion once. Never complete a task just because the player
opened its UI or approached the location.

Give the book separate Places and Things to do pages, with separate totals.
Use tabs on phones. Let Show the way track one task with a route that follows
real passages; the grove route must go through its gate and courtyard path.
Preserve the existing browser storage key and saved IDs when extending this
repository. Migrate old saves, reject invalid values, and retain discoveries,
memories, appearance, travel badges, parked bikes, and partial task progress.

## 10. Build selfie mode and a compact interface

Provide a selfie camera with horizontal orbit, vertical tilt, zoom, and frame
height. Support mouse drag, scroll, pinch, a mobile camera pad, arrow keys,
plus/minus, and W/S for frame height. Keep limits safe at the poles and around
walls. Show the explorer's face and smile clearly. Save a PNG without the game
interface, then show a preview and download link. Use La Terreta in the photo
brand and filenames. Validate the Falla activity from the captured view.

Keep desktop access to the book, view, explorer, selfie, sound, and Settings.
Keep the mobile row compact with Book, view, selfie, and Settings; place less
frequent options in Settings. Provide accessible names, focus styles, large
touch targets, readable action bubbles, and safe-area spacing. Keep essential
buttons visible without covering the player or movement controls.

Translate visible copy into English, Spanish, and Valencian. Change document
language, title, description, and loading text with the selected language.
Do not expose untranslated message keys. DONA and HOME stay unchanged.

## 11. Create and mix sound

Create original city and forest instrumental music plus a moving Fallas brass
band. Use the local audio generation scripts and store prompts and metadata
beside the audio. Keep credentials local and ignored. Do not generate paid
assets without a user request. The browser must use shipped files only.

Blend city and forest music according to location. Keep city music quiet and
distant. As the player approaches the band, bring it forward and lower ambient
music. Apply distance filtering and stereo position relative to the camera.
Use loop blending to avoid clicks and gaps. Reuse sources across state changes.

Add local water, rowing, tram, bicycle bell, birds, café, bull, masclet, and
linked firecracker sounds. Keep footstep playback disabled. Synchronize effects
with visible events. Start sound off. Mute or suspend the mix during pause,
photo mode, globe view, a hidden tab, and page exit. Resume cleanly without
stacking sources. Check audible transitions and silence in the running browser.

## 12. Check, document, and prepare delivery

Add Light, Balanced, and High quality settings. Bound pixel ratio, shadow cost,
distant geometry, draw calls, and per-frame allocations. Use shared geometry,
materials, and instances where useful. Check ground contact, camera stability,
transparent water, and object visibility in close and globe views. Measure on
real desktop and mobile viewports and state any limits honestly.

Run the production build and focused checks for movement, wetland, immersion,
props, and character exports. Exercise the game with keyboard and touch. Check
entry and exit for each transport and activity, reverse recovery, poles, saves,
reloads, language changes, photos, sound states, and missing assets. Repair
failures before reporting completion. Keep temporary evidence in ignored output.

Write README.md with the product, controls, run commands, checks, useful asset
builders, and deployment steps. Write AGENTS.md with source boundaries, saved
data rules, asset contracts, and focused validation instructions. Keep this
PROMPT.md as the ordered build brief. Use the MIT license with rolottr as the
copyright holder and preserve third-party notices.

Prepare Vercel with the Vite framework, Node.js 24, npm ci, npm run build, and
dist as output. Include shipped public assets. Exclude local keys, Blender
sources, temporary output, and build tools from CLI uploads. Deployment must
need no Python, Blender, database, or environment variables. Check the local
production build before a preview deployment, and check the preview before
production publication.

## 13. Add page-view analytics

Install `@vercel/analytics`. Use its `inject` function once at startup in
production builds. Keep tracking off in local development. Enable Web Analytics
in the Vercel project before deployment. Keep Node.js 24 aligned in package.json,
.nvmrc, and the Vercel project settings.

## 14. Add search and social metadata

Use a clear title and the full game description. Include canonical, Open Graph,
and Twitter large-image metadata in the static HTML so crawlers do not need
JavaScript. Use a real gameplay screenshot with absolute URLs and image size.
Keep translated title and description metadata aligned with the game language.
Add WebSite and VideoGame JSON-LD, robots.txt, a one-page sitemap, and a no-script
message. Use the verified production domain. Do not claim guaranteed rankings
or invent ratings, reviews, or alternate-language URLs.
