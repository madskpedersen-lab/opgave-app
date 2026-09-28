# Opgave-app – design

Dato: 2026-09-28

## Formål

En personlig app til Android-telefonen, der holder styr på opgaver og lader brugeren trække dem ind i ledige tidsrum i Google Calendar. Tilbagevendende opgaver (f.eks. bilvask) dukker op igen et bestemt interval efter, de er løst. Store opgaver (f.eks. byg drivhus) kan planlægges mange gange. Hver søndag mindes brugeren om at planlægge ugens opgaver.

Én bruger, én Google-konto. Ingen server.

## Arkitektur

- **Web-app (PWA)** bygget som statiske filer, hostet gratis på GitHub Pages. Åbnes i Chrome på Android og installeres på hjemmeskærmen (manifest + service worker).
- **Teknologi:** TypeScript + Vite, uden UI-framework (vanilla DOM-moduler). FullCalendar (timeGrid-visninger + interaction-plugin) til kalendervisning og touch-træk-og-slip. Vitest til tests.
- **Google-login:** Google Identity Services (token client) i browseren. Kræver et Google Cloud-projekt med OAuth-klient-ID (type "Web application", GitHub Pages-URL som tilladt origin), Calendar API og Drive API slået til. Projektet står i "Testing"-tilstand med brugeren selv som testbruger.
- **Scopes:**
  - `https://www.googleapis.com/auth/calendar` – læse alle kalendere, oprette kalenderen "Opgaver" og skrive begivenheder i den.
  - `https://www.googleapis.com/auth/drive.appdata` – gemme opgavedata i Drives skjulte app-mappe.

### Moduler

| Modul | Ansvar | Afhænger af |
|---|---|---|
| `domain/tasks` | Rene funktioner: opgavetyper, tilstandsskift, forfaldsberegning, gruppering af listen | intet |
| `domain/availability` | Rene funktioner: ledige tidsrum ud fra indstillinger + optagne perioder; overlap-tjek | intet |
| `domain/reconcile` | Rene funktioner: sammenhold opgaver med kalenderbegivenheder → liste af ændringer og "Blev det gjort?"-spørgsmål | `domain/tasks` |
| `google/auth` | Login, token-fornyelse, log ud | GIS-script |
| `google/calendar` | Kalenderliste, freeBusy, CRUD på begivenheder i "Opgaver", oprettelse af "Opgaver"-kalender og søndagsbegivenhed | `google/auth` |
| `google/drive` | Læs/skriv `data.json` i appDataFolder med ETag-baseret versionskontrol | `google/auth` |
| `store` | Appens tilstand i hukommelsen, lokal cache (localStorage), gem til Drive med retry | `google/drive`, `domain/*` |
| `ui/plan` | Planlæg-skærm: FullCalendar + opgaveskuffe | `store`, `google/calendar`, `domain/availability` |
| `ui/tasks` | Opgaveliste + opret/rediger-formular | `store` |
| `ui/settings` | Indstillinger | `store`, `google/calendar` |
| `ui/prompts` | "Blev det gjort?"-dialoger | `store` |

`domain/*` har ingen afhængighed til browser eller Google og testes direkte. `google/*` gemmer sig bag interfaces, så tests kan bruge en falsk implementation.

## Datamodel

Gemmes som én fil `data.json` i Drive appDataFolder. En kopi ligger i localStorage til brug uden net.

```ts
type Interval = { count: number; unit: 'day' | 'week' | 'month' };

type Task = {
  id: string;                 // uuid
  title: string;
  durationMin: number;        // ca. varighed; forslag til bloklængde
  kind: 'once' | 'recurring' | 'project';
  interval?: Interval;        // kun 'recurring'
  note?: string;
  createdAt: string;          // ISO
  // once / recurring:
  scheduled?: { eventId: string; start: string; end: string };
  dueDate?: string;           // kun 'recurring', ISO-dato (YYYY-MM-DD); mangler = forfalder nu
  // project:
  sessions?: Session[];       // planlagte og gennemførte arbejdsblokke
  // alle:
  completedAt?: string;       // once: færdig; project: afsluttet. Sat = vises i Historik
  history: string[];          // ISO-datoer for hver gang opgaven blev løst (recurring/once)
};

type Session = {
  eventId: string;
  start: string;
  end: string;
  status: 'planned' | 'done';
};

type Settings = {
  windows: Record<0|1|2|3|4|5|6, { start: string; end: string } | null>; // 0 = søndag; "HH:MM"; null = ingen tid
  sundayReminderTime: string;      // "HH:MM", standard "18:00"
  surfaceDaysBefore: number;       // standard 7
  tasksCalendarId?: string;        // id på "Opgaver"-kalenderen
  reminderEventId?: string;        // id på søndagsbegivenheden
};

type AppData = { version: 1; tasks: Task[]; settings: Settings };
```

Standard-tidsrum: man–fre 08:00–21:00, lør–søn 09:00–18:00.

## Opgavetyper og forløb

### Engang (`once`)
- **Klar** → træk ind i kalenderen → **Planlagt** (`scheduled` sat, begivenhed oprettet) → "Færdig" → `completedAt` sat, vises kun under Historik.
- "Fjern fra kalender": begivenheden slettes, `scheduled` fjernes, og opgaven er Klar igen.

### Tilbagevendende (`recurring`)
- Som engangsopgaven, men "Færdig" sætter `dueDate = færdigdato + interval`, fjerner `scheduled` og tilføjer datoen til `history`.
- Måned-interval lægges til med kalendermåneder. Hvis dagen ikke findes i måneden, bruges månedens sidste dag (31. jan + 1 md = 28./29. feb).
- **Hviler**, når `dueDate − surfaceDaysBefore > i dag`. Ellers vises den på listen (Forfalder snart / Klar).
- Opgaven er **forsinket** (rød), når `dueDate < i dag` og den ikke er planlagt.
- En ny tilbagevendende opgave har ingen `dueDate` og er Klar med det samme.

### Stor opgave (`project`)
- Bliver altid på listen, indtil "Afslut projekt" sætter `completedAt`.
- Hver træk ind i kalenderen opretter en ny `Session` (`planned`) og en ny begivenhed. Der må være flere planlagte sessioner samtidig.
- Visning: "N blokke · X timer", beregnet ud fra sessioner med `status: 'done'`.

## Kalenderintegration

- **"Opgaver"-kalender:** Oprettes ved første login, hvis `tasksCalendarId` mangler eller kalenderen ikke længere findes. Alle opgavebegivenheder skrives her.
- **Begivenheder:** titel = opgavens titel (stor opgave med præfiks "🔨 "). Begivenhedens `extendedProperties.private.taskId` sættes til opgavens id, så den kan genkendes.
- **Optaget tid:** `freeBusy` forespørges på alle kalendere i brugerens kalenderliste (`calendarList`), undtagen "Opgaver". Opgave-begivenheder vises separat som flytbare blokke.
- **Søndagspåmindelse:** Én gentagende begivenhed i "Opgaver"-kalenderen: "📋 Planlæg ugens opgaver", `RRULE:FREQ=WEEKLY;BYDAY=SU`, 15 min varighed, popup-påmindelse 0 min før. Beskrivelsen indeholder appens URL. Den oprettes ved første login og opdateres, når tidspunktet ændres i Indstillinger. Påmindelsen kommer via Google Kalender-appen.

## Afstemning (reconcile)

Kører, når appen åbnes eller kommer i forgrunden, og når Planlæg-skærmen henter en ny periode. Den henter begivenheder i "Opgaver"-kalenderen for alle `scheduled`/`planned`-referencer og sammenholder dem:

1. **Begivenhed flyttet** i Google Kalender → opdatér `start`/`end`.
2. **Begivenhed slettet** → once/recurring: fjern `scheduled` (Klar igen). project: fjern sessionen.
3. **Begivenhed overstået** (`end < nu`) og ikke markeret færdig → læg et spørgsmål i køen:
   - once/recurring: *"«Titel» var planlagt [dag] [tid]. Blev den gjort?"* **Ja** → Færdig med den planlagte dato som færdigdato (styrer næste `dueDate`). **Nej** → slet begivenheden, fjern `scheduled`.
   - project: *"Fik du arbejdet på «Titel» [dag]?"* **Ja** → session `done`. **Nej** → slet begivenheden, fjern sessionen.
   - Spørgsmålene vises ét ad gangen i en dialog, når appen åbnes.

Hvis brugeren trykker "Færdig" på en planlagt engangs- eller tilbagevendende opgave, **før** tiden er gået, bliver begivenheden stående i kalenderen som dokumentation, og færdigdatoen er i dag.

## Skærme

### 1. Planlæg (hovedskærm)
- Øverst: FullCalendar `timeGrid` med 3 dage (swipe/pile til næste periode, knap til 7-dages uge). Tidsakse 06–23.
- Optagne perioder fra freeBusy vises som grå, ikke-flytbare baggrundsblokke. Ledige tidsrum fra `settings.windows` vises med lys baggrund, resten med mørkere baggrund.
- Opgavebegivenheder (begivenheder i "Opgaver"-kalenderen med `taskId`, dvs. ikke søndagsbegivenheden) vises i appens farve og kan flyttes og ændres i længde (snap til 15 min).
- Nederst: opgaveskuffe (kan trækkes op/ned) med Klar-, Forfalder snart- og Store opgaver-grupperne. Hold og træk en opgave op i kalenderen for at planlægge den. Blokken får `durationMin` som længde.
- **Validering ved slip/flyt/længdeændring:** blokken skal ligge helt inden for et ledigt tidsrum og må ikke overlappe optaget tid eller andre opgaveblokke. Ugyldige positioner vises med rødt og afvises (blokken hopper tilbage).
- Tryk på en blok: Færdig / Fjern fra kalender / Rediger opgave.

### 2. Opgaver
- Grupper: **Forfalder snart** (tilbagevendende, sorteret efter `dueDate`, forsinkede i rødt), **Klar**, **Planlagt**, **Store opgaver**, **Hviler** (sammenklappet, viser næste forfaldsdato), **Historik** (sammenklappet).
- "+"-knap til en formular: titel, varighed (hurtigvalg 15/30/45 min, 1/1½/2/3 timer + fri), type (Engang / Tilbagevendende / Stor opgave), interval (antal + dage/uger/måneder) for tilbagevendende, note.
- Rediger og slet opgave. Hvis opgaven har planlagte begivenheder, spørger appen, om de også skal slettes.

### 3. Indstillinger
- Ledige tidsrum pr. ugedag (fra–til eller "ingen tid").
- Tidspunkt for søndagspåmindelse.
- Dage før forfald, hvor tilbagevendende opgaver vises.
- Log ud.

## Fejlhåndtering

- **Token udløbet:** `google/auth` fornyer adgangen stille (`prompt: ''`). Hvis det fejler, vises banneret "Log ind igen". Handlingen, der fejlede, gentages efter login.
- **Uden net:** Appen starter fra service worker-cache og localStorage-kopien. Opgavelisten kan ses, men planlægning og ændringer er slået fra, og banneret "Ingen forbindelse" vises.
- **Samtidige ændringer:** Drive-skrivning sender `If-Match: <etag>`. Ved 412 hentes den nyeste fil, den lokale ændring anvendes igen (ændringer udtrykkes som funktioner på `AppData`), og skrivningen prøves igen (maks. 3 gange).
- **Kalender-kald fejler** (andet end auth): handlingen rulles tilbage i UI'et, og der vises en kort fejlbesked. Opgavedata ændres først, når kalender-kaldet er lykkedes.

## Test

- **Enhedstests (Vitest)** for `domain/*`: forfaldsberegning inkl. månedsgrænser, hvile/forfald-gruppering, ledige tidsrum og overlap, alle afstemningstilfælde, tilstandsskift for alle tre typer.
- **Integrationstests** for `store` + falske `google/calendar`/`google/drive`: planlæg → flyt → færdig, ETag-konflikt, offline-tilstand.
- **Manuel test** på brugerens Android-telefon: installation på hjemmeskærm, login, træk-og-slip med fingeren, søndagspåmindelse.

## Opsætning (brugerens trin)

1. Opret Google Cloud-projekt, slå Calendar API og Drive API til, konfigurer OAuth consent screen (External, Testing, brugeren selv som testbruger), og opret et OAuth-klient-ID af typen Web med `https://<bruger>.github.io` og `http://localhost:5173` som tilladte origins.
2. Klient-ID'et indsættes i appens konfiguration.
3. GitHub-repo + GitHub Pages-deploy via GitHub Actions.

## Uden for scope

- Flere brugere, deling, iPhone-specifik tilpasning.
- Automatisk placering af opgaver.
- Egne push-notifikationer (søndagspåmindelsen går via Google Kalender).
- Prioriteter, tags, underopgaver.
