#!/usr/bin/env node
/**
 * Garde-fou avant `eas update`.
 *
 * Une OTA ne livre que du JavaScript. Si ce JavaScript importe un module
 * **natif** absent du binaire installé, l'application plante au chargement de
 * l'écran concerné — et rien, ni au build ni à la publication, ne le signale.
 * C'est arrivé avec `expo-haptics` : ajouté le 21 juillet, livré par OTA sur un
 * binaire du 2 juillet, deux mois de crashs sur l'onglet Calendrier.
 *
 * Ce script compare les dépendances **natives** du code actuel à celles du
 * commit qui a produit le dernier build natif. Toute dépendance native ajoutée
 * depuis bloque la publication : il faut un nouveau build, ou charger le module
 * paresseusement (cf. `src/lib/haptics.ts`).
 *
 * Usage : node scripts/check-ota-safe.mjs [--platform ios|android]
 * Contournement explicite : OTA_GUARD_SKIP=1 (à n'utiliser qu'en connaissance
 * de cause, par exemple juste après un build natif pas encore référencé).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// `indexOf` rend -1 quand le drapeau est absent : lire `argv[0]` donnerait le
// chemin de node en guise de plateforme, et EAS répondrait par une erreur
// obscure. D'où le test explicite.
const positionPlateforme = process.argv.indexOf('--platform');
const PLATEFORME = (
  positionPlateforme === -1 ? 'ios' : (process.argv[positionPlateforme + 1] ?? 'ios')
).toLowerCase();
const PROFIL = 'production';

const ESC = String.fromCharCode(27);
const rouge = (t) => ESC + '[31m' + t + ESC + '[0m';
const vert = (t) => ESC + '[32m' + t + ESC + '[0m';
const jaune = (t) => ESC + '[33m' + t + ESC + '[0m';

if (process.env.OTA_GUARD_SKIP === '1') {
  console.log(jaune('⚠ Garde-fou OTA ignoré (OTA_GUARD_SKIP=1).'));
  process.exit(0);
}

function sortirEnErreur(message) {
  console.error('\n' + rouge('✖ Publication OTA bloquée') + '\n' + message + '\n');
  process.exit(1);
}

/**
 * Une dépendance est « native » si le paquet installé embarque du code de
 * plateforme : dossier ios/ ou android/ non vide, podspec, ou déclaration de
 * module Expo. Se fier au nom (`expo-*`) serait faux dans les deux sens —
 * `expo-router` est du JavaScript, et l'inverse existe aussi.
 */
function estNative(nomPaquet) {
  const racine = join(process.cwd(), 'node_modules', nomPaquet);
  if (!existsSync(racine)) return false; // non installé : rien à vérifier
  if (existsSync(join(racine, 'expo-module.config.json'))) return true;
  for (const dossier of ['ios', 'android']) {
    const chemin = join(racine, dossier);
    if (existsSync(chemin)) {
      try {
        if (readdirSync(chemin).length > 0) return true;
      } catch {
        /* illisible : on ne tranche pas dessus */
      }
    }
  }
  try {
    return readdirSync(racine).some((f) => f.endsWith('.podspec'));
  } catch {
    return false;
  }
}

function dependances(contenuPackageJson) {
  const parsed = JSON.parse(contenuPackageJson);
  return { ...(parsed.dependencies ?? {}) };
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

// ---------- 1. Le dernier build natif ----------
let build;
try {
  const brut = execFileSync(
    'npx',
    [
      'eas-cli@latest',
      'build:list',
      '--platform',
      PLATEFORME,
      '--buildProfile',
      PROFIL,
      '--status',
      'finished',
      '--limit',
      '1',
      '--json',
      '--non-interactive',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  build = JSON.parse(brut)[0];
} catch {
  sortirEnErreur(
    "Impossible d'interroger EAS pour connaître le dernier build natif.\n" +
      'Vérifiez la connexion et `eas whoami`, ou publiez en connaissance de cause avec OTA_GUARD_SKIP=1.',
  );
}

if (!build || !build.gitCommitHash) {
  sortirEnErreur(
    'Aucun build ' + PLATEFORME + '/' + PROFIL + " terminé n'a été trouvé, ou il ne porte pas de commit.\n" +
      "Sans référence, impossible de savoir ce que le binaire embarque.",
  );
}

const commit = build.gitCommitHash;
const versionBinaire = build.appVersion + ' (' + build.appBuildVersion + ')';

// ---------- 2. Les dépendances des deux côtés ----------
let packageAuBuild;
try {
  packageAuBuild = git('show', commit + ':package.json');
} catch {
  sortirEnErreur(
    'Le commit du dernier build (' + commit.slice(0, 8) + ') est introuvable en local.\n' +
      'Faites `git fetch --all` : sans ce commit, la comparaison est impossible.',
  );
}

const avant = dependances(packageAuBuild);
const maintenant = dependances(readFileSync('package.json', 'utf8'));

const ajoutees = Object.keys(maintenant).filter((nom) => !(nom in avant));
const modifiees = Object.keys(maintenant).filter(
  (nom) => nom in avant && avant[nom] !== maintenant[nom],
);

const nativesAjoutees = ajoutees.filter(estNative);
const nativesModifiees = modifiees.filter(estNative);

// ---------- 3. Verdict ----------
console.log(
  'Dernier build natif ' + PLATEFORME + ' : ' + versionBinaire + ' — commit ' + commit.slice(0, 8),
);

if (nativesModifiees.length > 0) {
  console.log(
    jaune(
      '\n⚠ Dépendances natives dont la version a changé depuis ce build :\n' +
        nativesModifiees.map((n) => '   ' + n + ' : ' + avant[n] + ' → ' + maintenant[n]).join('\n') +
        '\n   Une montée de version peut modifier le code natif. À vérifier si le comportement diffère.',
    ),
  );
}

if (nativesAjoutees.length > 0) {
  sortirEnErreur(
    'Ces dépendances natives ont été ajoutées après le build installé :\n' +
      nativesAjoutees.map((n) => '   ' + rouge('x') + ' ' + n + ' (' + maintenant[n] + ')').join('\n') +
      '\n\nLe binaire ' + versionBinaire + " ne les contient pas : l'écran qui les importe plantera." +
      '\n\nDeux issues :' +
      '\n   1. Lancer un build natif : eas build --platform ' + PLATEFORME + ' --profile ' + PROFIL +
      "\n   2. Charger le module paresseusement pour que l'absence soit sans effet" +
      '\n      (modèle : src/lib/haptics.ts)',
  );
}

console.log(vert('\n✔ Aucune dépendance native ajoutée depuis ce build — OTA sans risque.\n'));
