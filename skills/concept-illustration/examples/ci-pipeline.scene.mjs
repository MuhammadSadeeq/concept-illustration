// A delivery pipeline, built with the pipeline recipe.
// Pattern: recipes turn a short list into a finished, animated scene.
export default ({ recipes }) => recipes.pipeline({
  look: 'paper',
  title: 'From commit to production',
  stages: [
    { kind: 'laptop', label: 'Commit', ui: 'code', say: 'A developer pushes a commit', emits: 'doc' },
    { kind: 'gear', label: 'Build', say: 'The build turns source into a package', emits: 'box' },
    { kind: 'shield', label: 'Test', say: 'Automated tests check it', emits: 'box' },
    { kind: 'server', label: 'Production', hero: true, say: 'The new version goes live' },
  ],
});
