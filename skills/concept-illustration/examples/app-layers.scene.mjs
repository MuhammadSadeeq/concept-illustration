// The layers of a web application, built with the layers recipe.
// Pattern: stacked slabs with side labels; each layer lifts while its caption shows.
export default ({ recipes }) => recipes.layers({
  theme: 'clay',
  title: 'The layers of a web application',
  layers: [
    { label: 'Interface', sub: 'what people see and touch', icon: 'cursor', say: 'People only ever meet the top layer' },
    { label: 'Logic', sub: 'rules and decisions', icon: 'gear', say: 'Underneath, logic decides what happens' },
    { label: 'Data', sub: 'what is remembered', icon: 'database', say: 'Data keeps what must not be forgotten' },
    { label: 'Infrastructure', sub: 'where it all runs', icon: 'server', say: 'And infrastructure carries everything' },
  ],
});
