/// <reference types="vite/client" />
import { t } from "./i18n";
import { inject } from "@vercel/analytics";
import * as T from "three";
import { assetUrl } from "./public-assets";
import { loadActivityAssets } from "./activity-scene";
import { World } from "./world";
import { Game } from "./game";
import { initializeGameAnalytics } from "./game-analytics";
import { R } from "./data";
import { loadWetland } from "./wetland";
import { loadCraftedProps } from "./crafted-props";
import { loadBike } from "./bike";
import { loadCityAssets } from "./city-assets";
import { loadGardenAssets } from "./garden-assets";
import { loadCraftModels } from "./craft-models";
import { loadCharacters, getCharacterRig, animateCharacter, createCharacter } from "./characters";
import { UI } from "./ui";
import { ArtRenderer } from "./render";
import { createSky } from "./sky";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/playfair-display/latin-400.css";
import "@fontsource/playfair-display/latin-400-italic.css";
import "./style.css";
if (import.meta.env.PROD) inject({ mode: "production" });

async function main() {
  T.DefaultLoadingManager.setURLModifier(assetUrl);
  const canvas = document.querySelector<HTMLCanvasElement>("#world")!;
  const app = document.querySelector<HTMLElement>("#app")!;
  const touchScreen = matchMedia("(pointer: coarse)");
  let width = app.clientWidth, height = app.clientHeight;
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new T.Scene();
  const environment = new RoomEnvironment();
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(environment, 0.03).texture;
  scene.environmentIntensity = 0.25;
  environment.dispose();
  pmrem.dispose();
  scene.fog = new T.Fog("#adc6c9", 55, 170);
  const sky = createSky(scene);
  const camera = new T.PerspectiveCamera(
    48,
    width / height,
    0.08,
    900,
  );
  camera.position.set(85, 210, -215);
  camera.up.set(0, 0, -1);
  const hemi = new T.HemisphereLight("#c1d6fb", "#61719a", 1.15);
  hemi.name = "sky-light";
  scene.add(hemi);
  const sun = new T.DirectionalLight("#fff0d3", 3.2);
  sun.position.set(-140, 220, -180);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.00006;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);
  const fill = new T.DirectionalLight("#8daed3", 0.25);
  fill.position.set(100, -50, 150);
  scene.add(fill);
  await Promise.all([loadCharacters(), loadBike(), loadCraftedProps(), loadWetland(), loadGardenAssets(), loadCityAssets(), loadActivityAssets(), loadCraftModels()]);
  const world = new World(scene);
  const game = new Game(world, camera, renderer, sun);
  const ui = new UI(game);
  const analytics = initializeGameAnalytics(game);
  if (import.meta.env.DEV)
    Object.assign(window, { valencia: { game, world, renderer, camera, characters: { getCharacterRig, animateCharacter, createCharacter } } });
  await world.models();
  // Start from a valid path even when older browser state contains a blocked point.
  if (world.blocked(game.x, game.z)) {
    game.x = 0;
    game.z = 5;
  }
  const art = new ArtRenderer(renderer, scene, camera);
  game.capture = () => art.render(game.quality);
  ui.ready();
  const resize = () => {
    width = app.clientWidth; height = app.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    game.resetInput();
  };
  window.addEventListener("resize", resize);
  new ResizeObserver(resize).observe(app);
  const clock = new T.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    const compact = width <= 700 || height <= 600 || touchScreen.matches;
    if (!game.started && compact) {
      const title = document.querySelector<HTMLElement>('#welcome .brand')!.getBoundingClientRect();
      const choices = document.querySelector<HTMLElement>('#welcome .hero-choice')!.getBoundingClientRect();
      const top = title.bottom + 16;
      const region = { x: 16, y: top, w: width - 32, h: Math.max(60, choices.top - top - 16) };
      // Fit the planet inside the space left by the menu, in screen pixels.
      const angle = Math.atan(Math.tan(T.MathUtils.degToRad(45 / 2)) * Math.min(region.w, region.h) / height * .9);
      game.introHeight = (R + 12) / Math.sin(angle) - R;
      camera.far = Math.max(900, game.introHeight + 350);
      camera.setViewOffset(width, height, width / 2 - region.x - region.w / 2,
        height / 2 - region.y - region.h / 2, width, height);
    } else {
      game.introHeight = null;
      camera.far = 900;
      if (!game.started)
        camera.setViewOffset(width, height, -width * .18, 0, width, height);
      else camera.clearViewOffset();
    }
    game.step(dt);
    analytics?.step();
    const phase = game.environment.values;
    sky.update(camera, game.time, phase);
    sun.color.copy(phase.sun);sun.intensity=phase.sunIntensity;
    hemi.intensity=phase.skyIntensity;
    (scene.fog as T.Fog).color.copy(phase.fog);
    (scene.fog as T.Fog).near = !game.started ? camera.far - 300 : game.globe ? 550 : 55;
    (scene.fog as T.Fog).far = !game.started ? camera.far : game.globe ? 900 : 170;
    art.render(game.quality);
    ui.updateAnchors();
  });
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    game.paused = true;
    ui.toast(
      t("The graphics view stopped. Reload the page to return to your saved journal."),
    );
  });
  window.addEventListener("pagehide", () => game.save());
}
main().catch((error) => {
  console.error(error);
  const el =
    document.querySelector<HTMLElement>("#loading") ||
    document.querySelector<HTMLElement>("#ui")!;
  el.innerHTML =
    `<div class="settings-body"><h2>${t("The world could not start.")}</h2><p>${t("Please reload the page. This game needs a browser with WebGL 2.")}</p><button class="primary" onclick="location.reload()">${t("Try again")}</button></div>`;
});
