# Gestion des Finances

Application de **suivi des dépenses de l'entreprise**, de la pièce justificative
jusqu'à l'état de fin de période.

Un collaborateur charge son justificatif et l'assigne à un approbateur → l'approbateur
reçoit un email, ouvre le document et statue → une fois réglée, **le demandeur revient
confirmer la réception, déposer les factures définitives et laisser un message** → à
tout moment, la direction édite **l'état de la période accompagné de toutes les
preuves**, dans un seul dossier.

---

## Sommaire

- [Démarrage rapide](#démarrage-rapide)
- [Comptes de démonstration](#comptes-de-démonstration)
- [Le circuit métier](#le-circuit-métier)
- [Rôles et permissions](#rôles-et-permissions)
- [L'état de fin de période](#létat-de-fin-de-période)
- [Multi-devises](#multi-devises)
- [Rapports](#rapports)
- [Configuration](#configuration)
- [Sécurité](#sécurité)
- [Déploiement](#déploiement)
- [Structure du code](#structure-du-code)
- [Ce qui reste à faire (lot 3)](#ce-qui-reste-à-faire-lot-3)

---

## Démarrage rapide

Prérequis : **Node 20+** et **PostgreSQL 14+**.

```bash
npm install
cp .env.example .env          # puis ajustez DATABASE_URL et AUTH_SECRET
createdb gestion_finances
npx prisma migrate dev
npm run db:seed               # jeu de démonstration (facultatif)
npm run dev
```

L'application est sur <http://localhost:3000>.

Générer un `AUTH_SECRET` solide :

```bash
openssl rand -base64 48
```

En développement, `MAIL_DRIVER=console` : les emails ne partent pas, ils
s'affichent dans la console du serveur — pratique pour récupérer un lien de
connexion sans serveur SMTP.

### Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` / `npm start` | build et exécution en production |
| `npm run typecheck` | vérification TypeScript |
| `npm run db:migrate` | crée et applique une migration |
| `npm run db:deploy` | applique les migrations (production) |
| `npm run db:seed` | jeu de démonstration (`SEED_FORCE=1` pour régénérer) |
| `npm run db:studio` | explorateur de base Prisma |
| `npx tsx scripts/lien-connexion.ts <email>` | fabrique un lien de connexion sans email |
| `npx tsx scripts/test-double-approbation.ts` | vérifie qu'une demande ne peut être approuvée qu'une fois |
| `npx tsx scripts/test-reference-reglement.ts` | vérifie qu'une référence de règlement ne peut jamais être dupliquée |

## Comptes de démonstration

Mot de passe commun : **`Demo1234567`**

| Rôle | Email |
|---|---|
| Administrateur | `admin@demo.local` |
| Approbateur | `valideur@demo.local` · `valideur2@demo.local` · `valideur3@demo.local` |
| Demandeur | `demandeur@demo.local` · `demandeur2@demo.local` · `demandeur3@demo.local` |

La connexion se fait au mot de passe **ou** par lien à usage unique envoyé par email
(valable 30 minutes).

## Le circuit métier

```
BROUILLON ──soumettre──► EN_ATTENTE ──approuver──► APPROUVEE ──régler──► PAYEE
    ▲                        │  │                                          │
    │                        │  └──rejeter──────► REJETEE                  │
    └───resoumettre── INFO_DEMANDEE ◄──demander une info                   │
                                                                           │
            CONFIRMEE ◄── le demandeur confirme, joint ses pièces ─────────┘
                          définitives et laisse un message
```

Règles appliquées côté serveur, jamais seulement dans l'interface :

- un justificatif est **obligatoire** pour soumettre ;
- le demandeur **ne choisit pas** son approbateur : la liste vient de son compte ;
- **une seule décision suffit** quand plusieurs approbateurs sont désignés ;
- on ne peut **pas statuer sur sa propre dépense** ;
- un **motif est obligatoire** pour rejeter ou demander un complément ;
- seule une dépense **approuvée** peut être marquée réglée ;
- **seul le demandeur** peut confirmer la réception, et uniquement une fois la
  dépense réglée : un message **et** au moins une pièce définitive sont exigés ;
- une dépense réglée ne peut plus être annulée ;
- **une demande ne peut être décidée qu'une seule fois** (voir ci-dessous) ;
- chaque action écrit une ligne dans le **journal d'audit**.

### Une seule décision par demande

Vérifier l'état puis écrire ne suffit pas : entre la lecture et l'écriture, un
double-clic, un second onglet ou une requête rejouée par le réseau peut glisser une
deuxième décision. Chaque changement d'état passe donc par une **écriture
conditionnelle atomique** : l'étape ne bascule que `WHERE statut = 'EN_ATTENTE'`, la
demande aussi, et la transaction est annulée si la mise à jour n'a touché aucune
ligne. La seconde décision reçoit *« Cette demande vient d'être traitée. »* — sans
second email, sans seconde ligne d'audit, sans double notification.

Le même verrou protège la soumission (pas de circuit créé deux fois), le règlement
(pas de double paiement enregistré) et l'annulation.

```bash
npx tsx scripts/test-double-approbation.ts
```

Ce test crée une demande jetable, lance **deux approbations exactement simultanées**,
vérifie qu'une seule aboutit, puis supprime la demande.

La table `approval_steps` matérialise le circuit avec un champ `ordre`. La V1 crée
une seule étape, mais le moteur de décision gère déjà le passage au niveau suivant :
activer le multi-niveaux ne demandera pas de migration de données.

### Qui valide quoi

**Le demandeur ne choisit pas son approbateur.** Ses approbateurs sont une propriété
de son compte, attribuée par l'administrateur : *Administration → Utilisateurs →
Approbateurs*. Un seul, ou jusqu'à trois.

```
Sandra Mbala   →  Clarisse Fotso, Serge Kouam
Yann Belinga   →  Marc Etoundi
```

Quand plusieurs personnes sont désignées, elles sont **toutes sollicitées en même
temps** — ce n'est pas un circuit à étages. La dépense apparaît dans la file *À
valider* de chacune, toutes reçoivent l'email, et **la première qui statue décide pour
tout le monde**. Les autres n'ont plus rien à faire : leur ligne passe à *« Traitée par
un autre approbateur »*, et une notification leur dit qui a tranché et dans quel sens.

C'est ce qui évite qu'une dépense reste bloquée parce qu'une seule personne est en
déplacement, tout en gardant une trace nominative de qui a décidé.

Deux garde-fous : un approbateur **désactivé est écarté** à la soumission, et un
compte **sans aucun approbateur ne peut pas soumettre** — le message le dit et renvoie
vers l'administrateur. L'écran d'administration signale aussi en orange un approbateur
**qui n'a jamais activé son compte** : il ne pourra pas se connecter, donc pas statuer.

La liste se modifie à tout moment ; le changement est tracé (`CIRCUIT_MODIFIE`) et ne
touche pas les dépenses déjà en cours.

### Le règlement

Marquer une dépense réglée ne demande **aucune saisie** : un bouton, et c'est tout.

- La **date** est celle du jour, prise au moment du clic.
- La **référence** est générée par l'application : `REG-2026-00031`. Une séquence
  annuelle propre aux règlements, distincte de celle des demandes — une dépense peut
  être créée sans jamais être réglée, les deux compteurs n'avancent pas au même rythme.

L'incrément se fait **dans la transaction du paiement** : deux règlements simultanés
obtiennent deux numéros différents, PostgreSQL sérialisant les écritures sur la ligne
du compteur. Un **index unique** sur `paymentRef` sert de dernier filet — la base
refuserait physiquement un doublon. C'est la différence avec un `max + 1` calculé à
côté, qui donne deux fois le même numéro dès que deux personnes cliquent ensemble.

```bash
npx tsx scripts/test-reference-reglement.ts
```

Ce test règle **12 dépenses exactement en même temps** et vérifie que les 12
références sont distinctes.

### La confirmation par le demandeur

Le règlement ne clôt pas la dépense. Tant que le demandeur n'a pas confirmé, elle
reste **`PAYEE` — « Réglée, à confirmer »**, et l'état de la période la signale.

Au moment du règlement, le demandeur reçoit un email : *« Réglée — merci de
confirmer et de joindre vos justificatifs »*. Sur la page de la dépense, un panneau
lui demande :

1. les **factures ou reçus définitifs** — au moins un fichier, obligatoire ;
2. un **message** — obligatoire, au moins 5 caractères.

La dépense passe alors en **`CONFIRMEE`**, le message est enregistré et repris dans
le fil des échanges, et celui qui a réglé, celui qui a validé et les administrateurs
reçoivent une notification et un email.

Les deux moments de preuve ne sont jamais mélangés : la pièce jointe à la demande
(`nature = DEMANDE`) et celles rapportées après le règlement
(`nature = CONFIRMATION`) sont séparées à l'écran, dans l'état et dans le dossier ZIP.

Comme les autres changements d'état, la confirmation est protégée par une écriture
conditionnelle atomique : elle n'a lieu qu'une seule fois.

## Rôles et permissions

Trois rôles, créés par l'administrateur depuis **Administration → Utilisateurs**.

| Rôle | Droits |
|---|---|
| **DEMANDEUR** | engage une dépense : créer, modifier son brouillon, soumettre, commenter, suivre, **confirmer la réception et rapporter ses pièces définitives** |
| **APPROBATEUR** | idem, plus **approuver / rejeter / demander un complément** sur ce qui lui est assigné, **marquer payé**, et consulter l'ensemble des dépenses, rapports et états |
| **ADMIN** | tout, plus la gestion des comptes, des référentiels et le journal d'audit |

**Qui crée les comptes.** Il n'existe **aucune inscription libre** : ni la page de
connexion, ni celle de définition du mot de passe ne peuvent créer un utilisateur.
Le seul chemin est l'administrateur, depuis l'application — chaque création laisse
une trace au journal d'audit avec le nom de son auteur.

La seule exception est l'amorçage du **tout premier** administrateur, par
`scripts/creer-admin.ts` : le script **refuse de s'exécuter dès qu'un administrateur
actif existe**, et écrit `ADMIN_AMORCE` au journal d'audit. Personne ne peut donc se
fabriquer un compte en ligne de commande pour contourner l'administrateur.

**Créer un compte** : *Administration → Utilisateurs → Créer un compte* — nom, email,
rôle, service, responsable, et un **mot de passe provisoire**. Le champ est
pré-rempli avec un mot de passe robuste généré dans le navigateur (bouton
« Générer » pour en tirer un autre) ; l'administrateur peut aussi saisir le sien.

**Aucun email n'est envoyé.** L'application affiche les identifiants une seule fois,
avec un bouton pour copier le mot de passe ou le message complet à transmettre :

```
Identifiants de Estelle Ngo Bassong — à remettre maintenant
  Adresse      estelle@exemple.com
  Mot de passe juKshSaHhakmL5          [afficher] [copier]
  [ Copier le message complet ]
```

Le mot de passe n'est stocké qu'en empreinte bcrypt : il ne pourra plus jamais être
relu, ni par l'application ni par l'administrateur. D'où l'affichage unique.

**Le changement est imposé à la première connexion.** Comme l'administrateur connaît
ce mot de passe, il ne doit pas survivre : le compte porte `doitChangerMotDePasse`, et
tant qu'il est vrai **aucune page de l'application n'est accessible** — toutes
redirigent vers `/changer-mot-de-passe`. L'écran redemande le mot de passe reçu (une
session laissée ouverte ne suffit donc pas à voler le compte), refuse un nouveau mot
de passe identique à l'ancien, et applique la même règle de robustesse que partout
ailleurs — source unique dans `src/lib/mot-de-passe.ts`.

**Mot de passe oublié** : le bouton *Réinitialiser* de la liste génère un nouveau mot
de passe, **révoque toutes les sessions ouvertes** du compte, et réimpose le
changement. Chaque utilisateur peut par ailleurs changer le sien à tout moment par
*Mon mot de passe* dans la barre latérale.

Tout est tracé au journal d'audit : `UTILISATEUR_CREE`, `MOT_DE_PASSE_REINITIALISE`,
`MOT_DE_PASSE_CHANGE`.

> **Quand le SMTP sera en place**, ce circuit restera valable ; on pourra en plus
> réactiver l'envoi automatique d'un lien de définition de mot de passe — la page
> `/definir-mot-de-passe` et les jetons `SET_PASSWORD` sont conservés.

## L'état de fin de période

`Suivi → État & justificatifs`. C'est le livrable : **l'état des dépenses de la
période, accompagné de toutes les preuves**, prêt à être remis à un comptable, à un
bailleur ou à un commissaire aux comptes.

Trois contenus possibles, parce que la question posée n'est pas toujours la même :

| Portée | Ce qu'elle retient |
|---|---|
| **Dépenses approuvées** (défaut) | tout ce qui a été validé, réglé ou non — la dépense engagée |
| **Dépenses payées** | tout ce qui est sorti de la caisse, confirmé ou non |
| **Tout** | y compris les rejets et l'en-cours, pour un contrôle complet |

Trois formats de sortie :

- **Dossier complet (ZIP)** — c'est le format qui répond à « l'état avec toutes les
  preuves ». Il contient l'état Excel **et** chaque pièce justificative, rangée dans
  `Justificatifs/` et **renommée d'après la référence de sa dépense** :
  ```
  Dossier depenses 2026.zip
  ├── Etat des depenses - 2026 Depenses approuvees payees ou non.xlsx
  ├── Justificatifs/                      ← les pièces jointes à la demande
  │   ├── DEM-2026-00019 - Renouvellement des licences antivirus.pdf
  │   └── …
  ├── Pieces apres reglement/             ← celles rapportées à la confirmation
  │   ├── DEM-2026-00019 apres reglement - Renouvellement des licences antivirus.pdf
  │   └── …
  └── CONFIRMATIONS-EN-ATTENTE.txt        ← si des demandeurs n'ont pas confirmé
  ```
- **État seul (Excel)** — mis en forme, filtre automatique, ligne de totaux.
- **État seul (CSV)** — séparateur `;`, BOM UTF-8, s'ouvre directement dans Excel.

Les colonnes **Justificatif de la dépense** et **Pièces après règlement** portent le
nom exact des fichiers rangés dans le ZIP : chaque montant est relié à ses preuves,
ligne par ligne, sans avoir à chercher. L'état porte aussi la date de confirmation et
le **message du demandeur**.

Le ZIP est produit **en flux** : les pièces y sont ajoutées une par une, jamais
toutes chargées en mémoire — un état annuel de plusieurs milliers de justificatifs
ne fait pas tomber le serveur.

### Le contrôle des preuves manquantes

Une dépense ne peut pas être soumise sans justificatif, mais un fichier peut
disparaître du stockage (migration ratée, volume perdu). L'état ne le cache pas :

- l'écran affiche un compteur **« Sans justificatif »** et la liste des références
  concernées ;
- la ligne apparaît **en rouge** dans l'Excel ;
- le ZIP contient un fichier `PIECES-MANQUANTES.txt` qui les énumère.

De la même façon, une dépense réglée dont le demandeur n'a pas encore confirmé est
comptée à l'écran (**« En attente de confirmation »**), marquée **en orange** dans
l'Excel (`EN ATTENTE DE CONFIRMATION`) et listée dans `CONFIRMATIONS-EN-ATTENTE.txt`.

Un dossier remis à un tiers dit donc toujours la vérité sur ce qu'il contient.

## Multi-devises

Chaque dépense porte sa devise et **un seul montant** — pas de HT/TVA, pas de
fournisseur : ce qui compte ici est ce qui sort de la caisse, et la preuve associée.
Au moment de la **soumission**, l'application fige deux valeurs :

- `tauxChange` — le taux applicable à la date de la dépense ;
- `montantBase` — la contre-valeur dans la devise de référence (`BASE_CURRENCY`).

Tous les rapports et états agrègent `montantBase`. Conséquence voulue : **mettre à jour un
taux aujourd'hui ne modifie aucun rapport passé.** Les taux sont historisés
(`exchange_rates.validFrom`), pas écrasés.

Les devises sans sous-unité (XAF, XOF, JPY…) s'affichent sans décimales.

## Rapports

`Pilotage → Rapports`, avec sélecteur de période (jour, 7/30 jours, mois, mois
dernier, trimestre, année, année dernière, **plage personnalisée**), granularité
(jour / mois / année) et filtres service + catégorie.

- **KPIs** : soumis, approuvé, réglé, reste à valider, taux de rejet, délai médian
  et moyen de décision, montant rejeté, ticket moyen — chacun comparé à la **même
  période l'an dernier**.
- **Évolution** : barres groupées **réglé / approuvé non réglé / en attente / rejeté**,
  avec **vue tableau** alternative. Les quatre séries sont mutuellement exclusives —
  « approuvé » exclut ce qui est déjà réglé, sinon un même montant apparaîtrait deux
  fois à l'œil.
- **Répartitions** : catégorie, service, top demandeurs.
- **Tableau croisé** service × mois, en carte de chaleur.
- **Performance des approbateurs** : traitées, approuvées, rejetées, en attente,
  délai médian.
- **Exports** CSV (séparateur `;`, BOM UTF-8 — Excel français l'ouvre directement)
  et **Excel** mis en forme avec ligne de totaux et filtre automatique. Les exports
  reprennent les filtres affichés à l'écran.
- Un **PDF** s'obtient par l'impression du navigateur ; la mise en page masque la
  navigation et les contrôles.

Le tableau de bord porte les montants réglés du mois et de l'année, à côté de
l'en-cours et du réglé-non-confirmé.

La palette des graphiques a été validée sur les critères de bande de clarté, de
plancher chromatique, de séparation pour les daltonismes (protanopie, deutéranopie,
tritanopie) et de contraste, en thème clair comme sombre — l'ordre des quatre séries
suit le cycle de vie parce que c'est celui qui passe la séparation daltonisme. Chaque graphique porte une
légende et propose une vue tableau : la couleur ne porte jamais seule l'information.

## Configuration

Tout passe par des variables d'environnement (12-factor) — voir `.env.example`.

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | chaîne PostgreSQL |
| `APP_URL` | URL publique, utilisée dans les liens des emails |
| `AUTH_SECRET` | secret de session (48 octets aléatoires) |
| `SESSION_TTL_DAYS` | durée de vie d'une session (7 par défaut) |
| `STORAGE_DRIVER` | `local` (disque / volume) ou `s3` |
| `S3_*` | endpoint, région, bucket, clés — compatible S3, MinIO, Scaleway, R2 |
| `MAIL_DRIVER` | `console` (dev) ou `smtp` |
| `SMTP_*` | serveur d'envoi |
| `BASE_CURRENCY` | devise de référence des rapports (`XAF` par défaut) |
| `MAX_UPLOAD_MB` | taille maximale par fichier (20 par défaut) |

Changer d'hébergeur ou de fournisseur ne demande aucune modification de code :
seuls les drivers `storage` et `mail` changent de valeur.

## Sécurité

- **Sessions serveur révocables** : le cookie ne contient qu'un jeton aléatoire
  opaque, seule son empreinte SHA-256 est stockée. Désactiver un compte ou changer
  son mot de passe révoque immédiatement les sessions ouvertes.
- **Mots de passe** : bcrypt (coût 12). L'administrateur ne choisit ni ne voit
  jamais un mot de passe : il envoie une invitation, l'utilisateur définit le sien.
- **Limitation de débit** sur la connexion et l'envoi de liens, par IP et par compte.
- **Non-énumération des comptes** : la demande de lien répond la même chose que
  l'adresse existe ou non.
- **Uploads** : la signature binaire réelle est vérifiée (`%PDF`, en-têtes JPEG/PNG/WebP),
  pas l'extension ; taille plafonnée ; empreinte SHA-256 conservée pour prouver
  qu'une pièce n'a pas été substituée, et détecter les doublons entre demandes.
- **Fichiers jamais publics** : ils transitent par `/api/fichiers/[id]`, qui vérifie
  le droit d'accès (demandeur, approbateur du circuit, ou rôle transverse), renvoie
  `Cache-Control: private, no-store` et journalise chaque consultation.
- **Journal d'audit en ajout seul** : aucune fonction de l'application ne met à jour
  ni ne supprime une ligne.
- En-têtes `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy` posés globalement.

Avant une mise en production, prévoyez en plus :

1. **HTTPS obligatoire** (le cookie passe en `secure` automatiquement en production).
2. **Analyse antivirus** des pièces jointes — le champ `attachments.scanStatus`
   existe et le téléchargement bloque déjà les fichiers `INFECTE` ; il reste à
   brancher ClamAV dans `enregistrerPiecesJointes` (`src/app/(app)/demandes/actions.ts`).
3. **Sauvegardes** PostgreSQL chiffrées + test de restauration, et sauvegarde du
   stockage de fichiers.
4. **Supervision** : Sentry ou équivalent, plus une sonde sur `/`.

## Déploiement

L'application est agnostique. Deux chemins prêts à l'emploi :

**Docker Compose** — une seule commande, base de données comprise :

```bash
./demarrer.sh
```

Au premier lancement, le script génère les secrets dans `.env.docker`, construit
l'image, démarre PostgreSQL, applique les migrations, crée le compte
administrateur et **affiche ses identifiants**. Aux lancements suivants il
redémarre simplement, sans rien recréer.

```
L'application tourne sur http://localhost:8080

  PREMIER DÉMARRAGE — compte administrateur créé
  Connexion    : http://localhost:8080/login
  Adresse      : admin@local
  Mot de passe : WHmXQT2NgP3L9b
```

Le port par défaut est **8080**, pour ne pas gêner un serveur de développement
sur 3000. Adresse de l'administrateur, port, devise et SMTP se règlent dans
`.env.docker`, généré au premier lancement et **jamais versionné**.

| | |
|---|---|
| Arrêter | `docker compose --env-file .env.docker down` |
| Journaux | `docker compose --env-file .env.docker logs -f app` |
| Tout effacer | `docker compose --env-file .env.docker down -v` |

Deux services : `db` (PostgreSQL, avec *healthcheck* — l'application n'est lancée
que lorsque la base répond vraiment) et `app`. Deux volumes persistants : `db-data`
pour les données, `files` pour les justificatifs ; passez à `STORAGE_DRIVER=s3` pour
externaliser ces derniers.

L'image est construite en trois étapes (dépendances → compilation → image finale),
tourne sous un utilisateur non-root, et applique `prisma migrate deploy` au
démarrage : impossible de partir avec un schéma en retard sur le code.

Le `.dockerignore` réduit le contexte de build à quelques kilo-octets et surtout
**empêche `.env` et `storage/` d'entrer dans l'image**.

Cette pile a été montée et vérifiée de bout en bout : base saine, **16 tables créées
par les migrations au démarrage**, application accessible, connexion fonctionnelle.

> **Attention au volume PostgreSQL.** Depuis la version 18, l'image officielle range
> ses données dans un sous-répertoire versionné de `/var/lib/postgresql`. Le montage
> historique sur `/var/lib/postgresql/data` fait démarrer le conteneur sur un volume
> qu'il considère comme inutilisé, et le *healthcheck* échoue en boucle — l'`app`
> n'est alors jamais lancée. Le `docker-compose.yml` monte donc
> `db-data:/var/lib/postgresql`.

Si vous préférez piloter Compose vous-même, le premier administrateur se crée aussi
à la main dans le conteneur :

```bash
docker compose exec app npx tsx scripts/creer-admin.ts "Nom Prénom" admin@entreprise.com
```

**Plateforme managée** (Vercel, Railway, Render) : renseignez les mêmes variables,
utilisez un PostgreSQL managé et `STORAGE_DRIVER=s3` — un système de fichiers
éphémère ne convient pas aux justificatifs.

Hors Docker, la même commande se lance directement :

```bash
npx tsx scripts/creer-admin.ts "Nom Prénom" admin@entreprise.com
```

Elle affiche un lien valable 48 h ; le titulaire définit lui-même son mot de passe.

## Structure du code

```
prisma/
  schema.prisma           modèle de données commenté
  seed.ts                 jeu de démonstration
scripts/
  creer-admin.ts          premier administrateur
  lien-connexion.ts       lien de connexion hors email
  test-double-approbation.ts  vérifie l'unicité de la décision en concurrence
  test-reference-reglement.ts vérifie l'unicité des références de règlement
src/
  lib/                    env, prisma, formatage monétaire et dates, utilitaires
  server/                 logique métier — aucune n'est dans les composants
    auth.ts               sessions, mots de passe, jetons à usage unique
    requests.ts           circuit : création, soumission, décision, règlement
    circuit.ts            approbateurs attachés au compte
    currency.ts           taux de change et conversion figée
    reports.ts            agrégats et séries temporelles
    export.ts             CSV, Excel et dossier ZIP des justificatifs
    etat.ts               portées et filtres de l'état de fin de période
    storage.ts            drivers disque / S3, vérification des fichiers
    mail/                 envoi et gabarits d'emails
    audit.ts              journal en ajout seul
    notifications.ts      notification in-app + email
  app/
    login/, definir-mot-de-passe/
    (app)/                espace authentifié
      demandes/           liste, création, détail, modification
      validations/        file d'attente de l'approbateur
      tresorerie/         file de règlement
      admin/              tableau de bord, registre, rapports, utilisateurs,
                          référentiels, journal d'audit
      etat/               état de fin de période et dossier de preuves
    api/fichiers/[id]/    téléchargement contrôlé
    api/export/demandes/  état / registre en CSV et Excel
    api/export/dossier/   dossier ZIP : état + toutes les pièces
  components/             interface réutilisable (table, filtres, graphiques…)
```

## Ce qui reste à faire (lot 3)

Le socle a été conçu pour les accueillir sans refonte :

- **Validation à plusieurs étages selon le montant** — aujourd'hui une seule décision
  suffit toujours. Exiger deux accords successifs au-delà d'un certain montant demande
  un moteur de règles et son écran d'administration ; la table `approval_steps` porte
  déjà un champ `ordre` prévu pour ça.
- **Relances automatiques** (J+2, J+5) et **escalade** — le champ
  `approval_steps.relanceAt` attend une tâche planifiée.
- **Délégation** pendant les absences — `approval_steps.delegatedFromId` est en place.
- **Double authentification** (TOTP) — `users.mfaSecret` est prévu au schéma.
- **Analyse antivirus** des pièces jointes (voir Sécurité).
- **Rapport mensuel automatique** envoyé par email à la direction.
- **Suivi budgétaire** par service (`departments.budgetAnnuel` est déjà saisi).
- **OCR** pour pré-remplir le montant depuis le justificatif.
