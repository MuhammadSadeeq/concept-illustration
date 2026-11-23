// Build, measure, learn: a loop that feeds itself, built with the cycle recipe.
export default ({ recipes }) => recipes.cycle({
  look: 'sunset',
  title: 'Build, measure, learn',
  stages: [
    { kind: 'cube', label: 'Build', icon: 'wrench', say: 'Build the smallest useful thing', emits: 'box' },
    { kind: 'bars', label: 'Measure', say: 'Measure how people use it', emits: 'cube' },
    { kind: 'bulb', label: 'Learn', say: 'Learn what to change', emits: 'gem' },
    { kind: 'document', label: 'Plan', say: 'Plan the next step, then go again', emits: 'doc' },
  ],
  center: { kind: 'gear', color: 'accent' },
});
