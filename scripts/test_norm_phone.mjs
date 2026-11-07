function normalizeLoginPhone(input) {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0') && digits.length >= 11) {
    digits = digits.replace(/^0+/, '');
  }
  return digits;
}

const tests = [
  '11920033501',
  '011920033501',
  '5511920033501',
  '+55 (11) 92003-3501',
  '+55 011 92003-3501',
  '(11) 92003-3501',
  '(011) 92003-3501',
  '11 920033501',
  '011 92003 3501',
  '55011920033501'
];

for (const t of tests) {
  const norm = normalizeLoginPhone(t);
  console.log(`"${t}" => "${norm}" (len=${norm.length}) -> ${norm === '11920033501' ? 'PERFEITO' : 'ERRO'}`);
}
