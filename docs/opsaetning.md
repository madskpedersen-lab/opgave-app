# Opsætning

Du skal gøre dette én gang. Det tager ca. 15 minutter.

## 1. GitHub

1. Opret en gratis konto på https://github.com, hvis du ikke har en.
2. Opret et nyt, **tomt** repository med navnet `opgave-app` (Public).
3. I Terminal, i mappen `~/opgave-app`:
   ```bash
   git branch -M main
   git remote add origin https://github.com/DIT-BRUGERNAVN/opgave-app.git
   git push -u origin main
   ```
4. På GitHub: **Settings → Pages → Source: GitHub Actions**.

Appens adresse bliver `https://DIT-BRUGERNAVN.github.io/opgave-app/`.

## 2. Google Cloud

1. Gå til https://console.cloud.google.com og opret et nyt projekt: "Opgave-app".
2. **APIs & Services → Library**: Slå **Google Calendar API** og **Google Drive API** til.
3. **APIs & Services → OAuth consent screen** (Google Auth Platform):
   - User type: **External**
   - App name: Opgaver, og din e-mail som support og kontakt
   - Under **Audience / Test users**: tilføj din egen Gmail-adresse
   - Under **Data access / Scopes**: tilføj `.../auth/calendar` og `.../auth/drive.appdata`
4. **Credentials / Clients → Create OAuth client ID**:
   - Type: **Web application**
   - Authorized JavaScript origins:
     - `https://DIT-BRUGERNAVN.github.io`
     - `http://localhost:5173`
   - Kopiér **Client ID** (ender på `.apps.googleusercontent.com`).

## 3. Sæt klient-ID ind

- **GitHub:** Settings → Secrets and variables → Actions → **Variables** → New variable: `GOOGLE_CLIENT_ID` = dit klient-ID. Kør derefter workflowet "Deploy" igen under **Actions**.
- **Lokalt:** Kopiér `.env.example` til `.env.local` og indsæt klient-ID'et.

## 4. På telefonen

1. Åbn `https://DIT-BRUGERNAVN.github.io/opgave-app/` i Chrome.
2. Log ind med Google. Du får en advarsel om, at appen ikke er verificeret. Det er normalt, fordi det er din egen app: tryk **Fortsæt**.
3. Chrome-menuen (⋮) → **Føj til startskærm / Installer app**.
4. Tjek i Google Kalender-appen, at kalenderen **Opgaver** er slået til (☰ → sæt flueben), så du får søndagspåmindelsen.
