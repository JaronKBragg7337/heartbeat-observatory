// The opening's spoken lines. Pure data, shared by opening.js (subtitles) and the voice system (who says it, and which
// voice). Port control and the flight deck are radio/intercom voices; the cabin crew and the driver are people in the scene.
import { CONTACTS } from './state.js';

export const PORT_CONTROL = 'Port control: inbound passenger service, approach approved.';
export const CABIN_CREW = 'Cabin crew: keep your harness fastened.';
export const FLIGHT_DECK_1 = 'Flight deck: port control, do you read?';
export const FLIGHT_DECK_2 = 'Flight deck: guidance lost. Brace.';
export const DRIVER_NEUTRAL = 'The port is neutral. You can find work there.';
export const DRIVER_SETTLEMENT = 'The passenger line has a settlement waiting for you.';
export const driverGreeting = (c) => `${c.name}: ${c.faction}. We saw you come down.`;
export const driverOffer = (c) => `${c.name}: Need a lift? You can ride with me, or follow the port lights.`;

/** Who says a caption line: { voice, source } where source names which actor's body the sound comes from. */
export function openingSpeaker(text, contact) {
  if (text === PORT_CONTROL) return { voice: 'radio', source: null };
  if (text === CABIN_CREW) return { voice: 'sunita', source: 'cabin' };
  if (text === FLIGHT_DECK_1 || text === FLIGHT_DECK_2) return { voice: 'intercom', source: null };
  if (contact && (text === driverGreeting(contact) || text === driverOffer(contact) || text === DRIVER_NEUTRAL || text === DRIVER_SETTLEMENT))
    return { voice: contact.person, source: 'driver' };
  return null;
}
/** Every line the opening can speak, for the clip generator. */
export function openingLines() {
  const out = [{ voice: 'radio', text: PORT_CONTROL }, { voice: 'sunita', text: CABIN_CREW },
    { voice: 'intercom', text: FLIGHT_DECK_1 }, { voice: 'intercom', text: FLIGHT_DECK_2 }];
  for (const c of CONTACTS) for (const t of [driverGreeting(c), driverOffer(c), DRIVER_NEUTRAL, DRIVER_SETTLEMENT]) out.push({ voice: c.person, text: t });
  return out;
}
