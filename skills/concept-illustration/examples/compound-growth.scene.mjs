// Compound interest: each year's gain is worked out on a bigger total, built with the growth recipe.
// Pattern: a quantity over time. Bars rise one after another, climbing up and to the right.
export default ({ recipes }) => recipes.growth({
  look: 'sky',
  floor: 'none',
  title: 'How compound interest grows savings',
  prefix: '$',
  values: [
    { value: 1000, label: 'Start', say: 'You put away $1,000 and leave it alone' },
    { value: 1403, label: 'Year 5', say: 'At 7% a year, interest is added to the total' },
    { value: 1967, label: 'Year 10', say: 'so next year it is worked out on more money' },
    { value: 2759, label: 'Year 15' },
    { value: 3870, label: 'Year 20', say: 'Growth earns growth: the steps keep getting taller' },
  ],
  token: 'coin',
});
