// A load balancer sharing traffic between servers, built with the fan-out recipe.
export default ({ recipes }) => recipes.fanout({
  theme: 'carbon',
  title: 'How a load balancer shares traffic',
  source: { kind: 'user', label: 'Clients' },
  router: { kind: 'cube', label: 'Load balancer', icon: 'share' },
  targets: [
    { kind: 'server', label: 'Server A' },
    { kind: 'server', label: 'Server B' },
    { kind: 'server', label: 'Server C' },
  ],
  mode: 'each',
  say: ['Requests arrive at one address', 'Each one is handed to a different server'],
});
