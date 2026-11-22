// A climb from beginner to expert, built with the steps recipe.
export default ({ recipes }) => recipes.steps({
  theme: 'blueprint',
  title: 'From beginner to expert',
  steps: [
    { label: 'Learn', sub: 'follow along', say: 'First you follow instructions' },
    { label: 'Practise', sub: 'build small things', say: 'Then you build small things alone' },
    { label: 'Ship', sub: 'release real work', say: 'Then you ship work that others rely on' },
    { label: 'Teach', sub: 'explain it to others', say: 'And finally you can teach it' },
  ],
});
