# HUD · training that writes itself

HUD is a free, open-source app for endurance athletes (triathlon, running, swimming, cycling). Every morning it tells you **what to do today and why**, writes your 4-week training blocks on its own and works out **how much to eat** for the day's training. It runs on iPhone inside [Scriptable](https://scriptable.app) and reads your data from [Intervals.icu](https://intervals.icu).

> **Italiano:** [README.it.md](README.it.md) · The app's interface is in Italian for now (see [Language](#language)).

**Status: testing.** It runs every day on real iPhones, but it is a young project: expect changes.

## What it does

- **Today** — readiness from HRV (7-day trend against your own baseline, not a single night), resting HR and sleep, with two separate lights: *systemic* (heart and recovery) and *tissues* (running impact). Today's session adapts itself when needed.
- **Plan** — 4-week blocks (3 load, 1 recovery) periodised backwards from your race, roughly 80/20, with a library of parametric sessions translated into your zones. Sessions go to the Intervals calendar and from there to your watch.
- **Thresholds** — threshold HR, threshold pace (from hard efforts or critical speed), swim CSS (400 + 200 test or several maximal distances) and FTP, estimated from your activities. A new value is written to Intervals only when a second effort confirms it.
- **Fuel** — resting metabolism (ten Haaf 2014), carbohydrates in g/kg by day type, protein and fat with floors, deficit as % of body weight, **calories that learn** from your weigh-ins and food log (Kalman filter), carb loading before races, in-session fuelling (gels, water and sodium per hour). **Safety floors** override everything.
- **3D exercise videos** — an anatomical figure performs the gym and mobility exercises in a loop; working muscles glow red, helpers pink, stretched muscles blue. Made with Blender from a CC0 body.
- **Route map and 3D** — every activity's route on a real map, full screen in 2D or 3D over the terrain, with a fly-along replay. The first and last 250 m are always cut off.
- **Gym log** — weight and reps for every set with − and +, suggested by the progression model; records (estimated 1RM) and next session's weight when you finish an exercise.
- **Water and barcodes** — one tap per glass towards a daily target that grows with training; packaged food from its barcode via Open Food Facts.
- **Power and pace curves** (full view) — best efforts over 84 days against the year, with CP/W′ and critical speed/D′, plus W′bal in rides with power.
- **Swimming** — stroke rate, strokes per length, distance per stroke and SWOLF for each swim, plus the SWOLF trend over two months.
- **The footprint** — the app's signature: every session is a row of capsules as wide as the time and as tall as the intensity; the outline is the plan, the fill is what you did.
- Home and Lock Screen widgets, evening notifications, food diary (Siri too), injury and illness mode, gym and mobility, activity sharing.
- **Sharing** — four story images (Activity, Day, Week, Race) on black, white or transparent backgrounds, all signed by the footprint.

## Install (iPhone)

1. Install **Scriptable** from the App Store.
2. Copy the contents of [`02_App_iPhone/HUD-70.3.js`](02_App_iPhone/HUD-70.3.js) into a new Scriptable script.
3. On Intervals.icu › Settings › Developer Settings, generate your **API key**.
4. Run the script: paste the key (it is stored in the iPhone Keychain) and answer the setup questions.

A short English guide is in [`docs/GUIDE.en.md`](docs/GUIDE.en.md); the full guide (Italian) is [`docs/GUIDA.md`](docs/GUIDA.md).

## Your data

Everything stays on your iPhone and in your iCloud: the app has no server, collects no usage statistics and sends nothing to anyone except the calls to Intervals.icu with your own key and downloads of public content: exercise videos and photos, map tiles (OpenFreeMap, terrain from AWS) and, when you look up a barcode, Open Food Facts. Those services only see what is asked (the map area, the barcode), never your route or your profile. Garmin data reaching you through Intervals remains subject to Garmin's and Intervals.icu's terms.

**Not a medical device.** Training and nutrition guidance is general: if you have a doctor, coach or dietitian, their advice wins.

## Language

The interface, notifications and code comments are in Italian. Translating the UI is welcome but large (the text lives inside the page templates in `02_App_iPhone/src/14-interfaccia.js` and the analysis in `12-analisi.js`): if you want to help, open an issue first so we can agree on a string table instead of scattered edits.

## Repository

| Folder | Contents |
| --- | --- |
| `02_App_iPhone` | The app: source in `src/` (22 files by topic), `costruisci.js` joins them into `HUD-70.3.js` |
| `04_Generatore` | Plan generator, threshold estimation, profile checks, test profiles and all the tests |
| `03_Versione_PC` | Desktop analysis dashboard built from the same engine |
| `09_Esporta_FIT` | Swim sessions as FIT files for Garmin watches |
| `11_Omini_3D` | 3D exercise videos: an anatomical figure (MakeHuman, CC0) whose working muscles light up, rendered with Blender |
| `01_Prodotto` | Product spec and diagrams |
| `docs` | User guides |

## Development

Requires Node.js 18 or newer.

```sh
cd 02_App_iPhone
npm install        # only for Scriptable API autocompletion in VS Code
npm run build      # joins src/ into HUD-70.3.js
npm test           # fuel, adaptive calories, HRV, generator, thresholds, checks
```

Always edit `02_App_iPhone/src/`; `HUD-70.3.js` is the build output and is never edited by hand. Blocks shared with the generator are copied with `node 04_Generatore/sincronizza-app.js`. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

HUD is free software: you can use, study, modify and redistribute it under the **GNU Affero General Public License 3.0** ([`LICENSE`](LICENSE)). If you distribute a modified version, or offer it to others as a network service, you must make its source code available under the same license.

© 2026 Matteo and the HUD contributors. Third-party components and data: [`NOTICE.md`](NOTICE.md).
