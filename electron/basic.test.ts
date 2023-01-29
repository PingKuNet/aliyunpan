import path from 'path'
import { existsSync } from 'fs'
import { assert, expect, test } from 'vitest'

function findExecutable(exe: string): string | null {
  exe = exe.replace('.exe', '');
  const envPath = process.env.Path || process.env.PATH || "";
  const envExt = process.env.PATHEXT || "";
  const pathDirs = envPath
    .replace(/["]+/g, "")
    .split(path.delimiter)
    .filter(Boolean);
  const extensions = envExt.split(";");
  const candidates = pathDirs.flatMap((d) =>
    extensions.map((ext) => path.join(d, exe + ext))
  );
  let arr = candidates.map(c => {
    if (existsSync(c)) {
      return c
    } else {
      return null;
    }
  }).filter(c => c != null);
  if (arr[0] != null) {
    return arr[0]
  } else {
    return null
  }
}

// Edit an assertion and save to see HMR in action

test('findExecutable()', () => {
  let result = findExecutable('aria2c')
  console.log(result)
})

// test('Math.sqrt()', () => {
//   expect(Math.sqrt(4)).toBe(2)
//   expect(Math.sqrt(144)).toBe(12)
//   expect(Math.sqrt(2)).toBe(Math.SQRT2)
// })

// test('JSON', () => {
//   const input = {
//     foo: 'hello',
//     bar: 'world',
//   }

//   const output = JSON.stringify(input)

//   expect(output).eq('{"foo":"hello","bar":"world"}')
//   assert.deepEqual(JSON.parse(output), input, 'matches original')
// })