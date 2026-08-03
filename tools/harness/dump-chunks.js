const fs = require("fs");
const s = fs.readFileSync(process.argv[2], "utf8");
for (const name of process.argv.slice(3)) {
  const i = s.indexOf(`var ${name} = "`);
  console.log(`\n===== ${name} =====`);
  if (i < 0) { console.log("(not found)"); continue; }
  const start = i + `var ${name} = `.length;
  // walk the string literal respecting escapes
  let j = start + 1, out = "";
  while (j < s.length) {
    const c = s[j];
    if (c === "\\") { out += s[j] + s[j + 1]; j += 2; continue; }
    if (c === '"') break;
    out += c; j++;
  }
  console.log(JSON.parse('"' + out + '"'));
}
