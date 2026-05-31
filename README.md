# Estia Ménage — App mobile

Application mobile (iOS + Android) de gestion de prestations de ménage Estia, pour admins et prestataires. Front mobile de [l'API Estia](https://github.com/Electrix67130/estia-menage).

## Stack

- **Expo SDK 54** + **React Native** 0.81
- **Expo Router** (file-based routing)
- **TypeScript** strict
- **TanStack Query** (cache & sync)
- **react-native-reanimated** + **gesture-handler** (animations, swipe gestures)
- **react-native-svg** (logo)
- **AsyncStorage** (token persistence)

## Démarrage rapide

Prérequis : Node 20+, Expo CLI, simulateur iOS ou Android (ou Expo Go sur ton téléphone).

```bash
npm install
npm start                  # ouvre Expo Dev Tools
# puis 'i' pour iOS, 'a' pour Android, ou scan le QR avec Expo Go
```

Configure l'URL de l'API dans `.env` (cf. `.env.example`).

## Architecture

```
src/
├── api/             Client HTTP, hooks React Query, types partagés
├── app/             Routes Expo Router (file-based)
│   ├── (tabs)/      Tab nav principal (Ménages, Logements, Équipe…)
│   ├── menage/      Fiche ménage + édition + création
│   ├── logement/    Fiche logement + édition + création
│   ├── client/      CRUD client
│   └── …
├── components/      Composants réutilisables (MenageCard, SheetHandle…)
├── constants/       Colors, Layout, Urls
├── contexts/        AuthContext, ThemeContext, DialogContext, I18nContext
├── hooks/           useColorScheme, useSwipeToClose, useKeyboardAwareModalStyle…
├── i18n/            Traductions (fr/en/de/es/it/pl/pt/tr)
└── lib/             Helpers (date, geo, capture photo…)
```

## Scripts npm

| Commande | Description |
|---|---|
| `npm start` | Dev server Expo (Metro) |
| `npm run ios` | Build + lance sur simulateur iOS |
| `npm run android` | Build + lance sur émulateur Android |
| `npm run lint` | Linter Expo |
| `npm test` | Tests Jest |

## Conventions

- **Parité mobile ↔ dashboard** : toute modification fonctionnelle doit être appliquée sur les deux, sauf exceptions documentées (gestion d'abonnement = dashboard seul ; pointage photo géolocalisé = mobile seul).
- Modales bottom-sheet : utiliser `<SheetHandle>` + `useSwipeToClose` pour cohérence visuelle et tap-outside-to-close.
- Pas d'`any` en TypeScript. Path alias `@/*` → `src/*`.

## Repos liés

- 🛠️ [estia-menage](https://github.com/Electrix67130/estia-menage) — API backend (Fastify + Knex).
- 🖥️ [estia-menage-dashboard](https://github.com/Electrix67130/estia-menage-dashboard) — admin (Next.js).
- 🌐 [estia-menage-website](https://github.com/Electrix67130/estia-menage-website) — site vitrine.
