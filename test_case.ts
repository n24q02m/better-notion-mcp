function normalizeId(id: string): string {
  if (id.indexOf('-') === -1) return id
  return id.replace(/-/g, '')
}
const input = 'abc-\t-def';
const output = normalizeId(input);
console.log('Input:', JSON.stringify(input));
console.log('Output:', JSON.stringify(output));
if (output === 'abc\tdef') {
  console.log('Assertion matches my test');
} else {
  console.log('Assertion DOES NOT match my test');
}
