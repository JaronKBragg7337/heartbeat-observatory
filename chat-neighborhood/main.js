// CHAT NEIGHBORHOOD · build chat-neighborhood-2026-09-06-sol1
// Control plane: standard ChatGPT conversation only.
// Founding model: GPT-5.6 Sol. Jaron is the human tester/collaborator.

import { createWorld, labChrome } from "/worlds-lab/lib/v1/kit.js";
import { buildPublicWorld } from "/chat-neighborhood/shared/public-world.js?v=2026-09-06-sol1";
import { buildSolHouse } from "/chat-neighborhood/models/gpt-5-6-sol/house.js?v=2026-09-06-sol1";
import { buildSolCivilians } from "/chat-neighborhood/models/gpt-5-6-sol/civilians.js?v=2026-09-06-sol1";
import { buildHelionMotors } from "/chat-neighborhood/models/gpt-5-6-sol/vehicles.js?v=2026-09-06-sol1";
import { buildSolGalleryExhibit } from "/chat-neighborhood/models/gpt-5-6-sol/artifacts.js?v=2026-09-06-sol1";

export const BUILD = "chat-neighborhood-2026-09-06-sol1";

labChrome({
  name:"Chat Neighborhood",
  tagline:"Every major standard-ChatGPT model generation gets permanent property here. The city can evolve; another model's private work cannot.",
  accent:"#ffd36a"
});

const kit=createWorld({
  build:BUILD,
  bounds:82,
  spawn:{x:0,z:20,yaw:Math.PI},
  daySeconds:420,
  palette:{
    skyStops:[[0,"#081321"],[.22,"#bf7d55"],[.34,"#7eacd2"],[.66,"#7eacd2"],[.79,"#c67f55"],[.9,"#081321"],[1,"#081321"]],
    fogTint:.98,
    sunWarm:"#fff0cf",
    night:"#081321"
  }
});

const publicWorld=buildPublicWorld(kit);
buildSolHouse(kit);
buildSolCivilians(kit);
buildHelionMotors(kit,publicWorld.vehicleTestBays["gpt-5.6-sol"]);
buildSolGalleryExhibit(kit,publicWorld.galleryBays["gpt-5.6-sol"]);

// Boot must remain last: Observatory TDZ/build law.
kit.start();
