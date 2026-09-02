# Maskines CSS

`globals.css` / `core.css` provide the foundation. The historical `legacy/`
files (in `legacy/manifest.json` order) and `themes.css` are source files, not
independent route bundles. Their file names do not establish ownership.

Run `npm run css:build` after editing those sources. `predev` and `prebuild`
also regenerate the files in `generated/`. Commit generated files with the
source change so builds that invoke `next build` directly have the same CSS.
Do not hand-edit generated CSS.

- Root layout imports only `generated/shared.css` plus the foundation and
  `marketplace-improvements.css`.
- Profile, public seller, authentication, sell and garage components import
  their own generated CSS. Component-level imports are deliberate: localized
  aliases can reuse a component without traversing its original route layout.
- Only selectors requiring the route's root class are extracted. Global
  navigation, keyframes, unknown rules and ambiguous functional selectors stay
  shared. Previously loaded feature CSS cannot match another route's markup.
- Each partition retains source order, declarations, selector specificity and
  media/support conditions. Moving partitions changes cross-partition order;
  retain browser checks for shared/feature interactions, themes and navigation.
- Add new UI using small component CSS modules; do not append another round
  of overrides to the historical layers.

Verification: `npm run test:css-seo` checks the complete selector/declaration
partition, feature scoping, order within partitions, generated-file freshness
and a shared-source size ceiling. `verify-legacy-css.mjs` still checks the
unchanged archival cascade. Neither test is a substitute for visual checks.

Measure compiled bytes using `scripts/measure-local-home.mjs` against a local
production server. Do not present raw or gzip byte reductions as field CWV or
a production speedup percentage.
