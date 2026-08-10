const regex = /^(?![A-Z]).+$/;
const str = "fix: 🛡️ Sentinel HIGH Fix XPIA tag wrapper evasion via JSON escapes";
const str2 = "fix: 🛡️ Sentinel: [HIGH] Fix XPIA tag wrapper evasion via JSON escapes";
console.log(regex.test(str));
console.log(regex.test(str2));
