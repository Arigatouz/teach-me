qc1: { type: 'tf', q: 'Clicking a properly connected label focuses its input.', answer: true,
  explain: 'That is why labels also enlarge the click target.' },
qc2: { type: 'mc', q: 'When does the browser check <code>required</code>?',
  options: ['On every keystroke', 'When the form is submitted', 'Only on the server'],
  answer: 1, explain: 'Constraint validation runs on submit, or when you call <code>checkValidity()</code>.' }
