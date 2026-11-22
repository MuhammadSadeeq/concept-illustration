// An AI agent answering a question by using tools and memory.
// Pattern: a hero in the middle on a pedestal, helpers around it, round trips that end in a result.
export default ({ scene }) => {
  const s = scene({ theme: 'clay', title: 'How an AI agent works through a task' });

  const stage = s.add('platform', { at: [0, 0], size: 2.8, tiers: 2 });
  const agent = s.add('robot', { on: stage, label: 'Agent', hero: true, float: { amp: 4 } });
  const ask = s.add('bubble', { at: [-5, 0], label: 'Question', icon: 'question' });
  const tools = s.add('gear', { at: [0, -4.8], label: 'Tools', sub: 'search, code, APIs' });
  const memory = s.add('database', { at: [0, 4.8], label: 'Memory' });
  const answer = s.add('document', { at: [5, 0], label: 'Answer', hidden: true });

  s.link(ask, stage);
  s.link(stage, tools, { arrow: 'both', style: 'dashed' });
  s.link(stage, memory, { arrow: 'both', style: 'dashed' });
  s.link(stage, answer);

  s.story([
    s.say('A question arrives'),
    s.send(ask, stage, { as: 'mail' }),
    s.pulse(agent),
    s.say('The agent calls a tool and reads the result'),
    s.send(stage, tools), s.pulse(tools), s.send(tools, stage, { as: 'cube' }),
    s.say('It checks what it already knows'),
    s.send(stage, memory), s.pulse(memory), s.send(memory, stage, { as: 'cube' }),
    s.say('Then it writes the answer'),
    s.glow(agent),
    s.send(stage, answer, { as: 'doc' }),
    [s.pop(answer), s.mark(answer, 'check')],
    s.wait(1.2),
  ]);
  return s;
};
