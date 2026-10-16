# HUD · quick guide (English)

The interface is in Italian; this guide maps what you see on screen to what it means. The full guide is [`GUIDA.md`](GUIDA.md).

## Install and update
1. Install **Scriptable** from the App Store.
2. Open `HUD-70.3.js` on the iPhone › Share › Scriptable (or create a script and paste the contents).
3. Intervals.icu › Settings › Developer Settings › generate your **API key**.
4. Run the script and paste the key: it is stored in the iPhone Keychain. Answer the setup questions (race, days, hours, sports, body).

To update: open the script in Scriptable › select all › paste the new version › Done. Key, diary and widgets are kept.

## The footprint (*l'impronta*)
Every session is a row of capsules: as wide as the time, as tall as the intensity. The **outline** is the plan, the **fill** is what you did; **orange** appears only above threshold. In the morning today's footprint is empty (*Da riempire*, "to be filled"); after training it fills and shows how much of the plan you completed.

## Tabs
| On screen | Means | What you find |
| --- | --- | --- |
| **Oggi** | Today | Readiness and verdict (*Pronto* ready, *Con cautela* with caution, *Riposo* rest), today's footprint, sleep, HRV, resting HR, form (*Forma*, TSB) and today's fuel. |
| **Piano** | Plan | One footprint per day, running impact, day-by-day sessions with their steps, the season ribbon up to the race, weekly review. |
| **Attività** | Activities | Each workout with map, charts, laps, metrics (for swims: stroke rate, strokes per length, distance per stroke, SWOLF) and records. |
| **Corpo** | Body | **Carburante** (fuel), weight, food diary, injury and illness. |
| **Progressi** | Progress | Fitness/fatigue/form chart and trends: run durability, bike HR drift, swim pace and SWOLF, resting HR and HRV. |

The **i** button next to titles explains each number in a couple of lines.

## Readiness, briefly
- **Systemic light** (*Sistemico*): your 7-day HRV average against your own 2-month normal range, plus resting HR, sleep and training load. One bad night alone does not turn the day red.
- **Tissue light** (*Tessuti*): running impact over recent days, to protect tendons and bones.
- If the day needs to change, the session is shortened or eased automatically and the reason is shown.

## Fuel (*Carburante*)
Daily calories and macros from resting metabolism (ten Haaf), carbohydrates in g/kg by day type (*riposo* rest, *facile* easy, *duro* hard, *lungo* long, *carico* loading), protein and fat with minimums, and an optional weight-loss deficit as % of body weight per week. After a few weeks of weigh-ins and food logs the calories **learn** your real expenditure (max ±300 kcal). Safety floors (minimum energy availability and calories) always win. Long sessions get a fuelling plan: carbs, water and sodium per hour.

## Thresholds (*Soglie*)
HUD estimates threshold HR, threshold pace, swim CSS and FTP from your activities and shows where each number comes from. It writes a new value to Intervals only when it is confirmed (for pace: a second similar hard effort). To fix a value after a lab or field test, set it in `hud-profilo.json` › `soglie`.

## Widgets and Siri
- Home Screen: Scriptable widget (small, medium, large) › Edit Widget › Script "HUD 70.3". Lock Screen: rectangular, circular or inline.
- Siri: Shortcuts app › new shortcut "How am I?" › Run Script › HUD 70.3.

## Settings (*Impostazioni*)
Gear icon at the top right: race, days, hours, sports, body, *Segnala un problema su GitHub* (report a problem: opens a GitHub issue with version, device and load times, no personal data) and *Diagnostica* (load times of the last openings).

## Sharing (*Condividi*)
Story images 1080×1920 signed by the footprint: **Attività** (activity), **Giornata** (day), **Settimana** (week), **Gara** (race countdown). Backgrounds: *Nero* black, *Bianco* white, *Sticker* transparent. *Copia* copies a PNG, *Video* animates the footprint filling in 3 seconds.

## Your data
Everything stays on your iPhone and iCloud (`iCloud Drive › Scriptable`). No server, no analytics. HUD is not a medical device.
