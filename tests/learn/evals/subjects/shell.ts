/**
 * Just enough shell parsing to see which files a command reads, for hosts whose only way to load
 * a skill is to read its SKILL.md through a shell. Pure. Not a test file.
 */

/** `/bin/zsh -lc '…'` and friends: the command a host wrapped in a login shell. */
const WRAPPED = /^\s*(?:\/\S*\/)?(?:ba|z)?sh\s+-l?c\s+([\s\S]+)$/;

/** Split into words, honouring single and double quotes and backslashes; operators become their own words. */
export function words(command: string): string[] {
  const out: string[] = [];
  let word = "";
  let started = false;
  const push = () => {
    if (started) out.push(word);
    word = "";
    started = false;
  };
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!;
    if (ch === "'") {
      const end = command.indexOf("'", i + 1);
      word += command.slice(i + 1, end < 0 ? undefined : end);
      started = true;
      i = end < 0 ? command.length : end;
    } else if (ch === '"') {
      i++;
      while (i < command.length && command[i] !== '"') {
        if (command[i] === "\\" && i + 1 < command.length) i++;
        word += command[i];
        i++;
      }
      started = true;
    } else if (ch === "\\" && i + 1 < command.length) {
      word += command[++i];
      started = true;
    } else if (/\s/.test(ch)) {
      push();
    } else if (ch === ">" || ch === "<") {
      // A redirect is its own word (`a.md>x`, `status>&1`). It stays attached to an fd (`2>`),
      // to `&` (`&>file`), or while `>>` is still growing (`>>`, `2>>`, `&>>`).
      const stays = /^\d+$/.test(word) || word === "&" || (ch === ">" && /^(?:\d+|&)?>$/.test(word));
      if (word !== "" && !stays) push();
      word += ch;
      started = true;
    } else if (ch === "&" && (/^\d*>$/.test(word) || command[i + 1] === ">")) {
      if (!/^\d*>$/.test(word)) push();
      word += ch;
      started = true;
    } else if (";|&".includes(ch)) {
      push();
      const op = command[i + 1] === ch ? ch + ch : ch;
      out.push(op);
      i += op.length - 1;
    } else {
      word += ch;
      started = true;
    }
  }
  push();
  return out;
}

/** The command a login-shell wrapper runs, or the command itself. */
export function unwrap(command: string): string {
  const m = WRAPPED.exec(command);
  if (m === null) return command;
  const inner = words(m[1]!);
  return inner.length === 1 ? inner[0]! : command;
}

/** Programs that print a file, and the options of each that take a value. */
const READERS: Record<string, ReadonlySet<string>> = {
  cat: new Set(),
  bat: new Set(["-r", "--line-range", "-l", "--language"]),
  head: new Set(["-n", "-c"]),
  tail: new Set(["-n", "-c"]),
  nl: new Set(["-b", "-w", "-s"]),
  less: new Set(),
  more: new Set(),
  sed: new Set(["-e", "-f"]),
};

const OPERATORS = new Set([";", "|", "||", "&", "&&"]);

/** Files a shell command prints, stdin redirects included. `sed`'s first operand is its script unless `-e` or `-f` gave one. */
export function readsOf(command: string): string[] {
  const all = words(unwrap(command));
  const files: string[] = [];
  let segment: string[] = [];
  const flush = () => {
    const [program, ...args] = segment;
    segment = [];
    const takesValue = program === undefined ? undefined : READERS[program.split("/").at(-1)!];
    if (takesValue === undefined) return;
    const operands: string[] = [];
    let scriptGiven = false;
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]!;
      const redirect = /^(\d*|&)(<|>>?)(&?)(.*)$/.exec(arg);
      if (redirect !== null) {
        const target = redirect[4] !== "" ? redirect[4]! : args[++i];
        if (redirect[2] === "<" && target !== undefined) operands.push(target);
        continue;
      }
      if (arg.startsWith("-") && arg !== "-") {
        if (takesValue.has(arg)) {
          if (arg === "-e" || arg === "-f") scriptGiven = true;
          i++;
        }
        continue;
      }
      operands.push(arg);
    }
    const isSed = program!.endsWith("sed");
    files.push(...(isSed && !scriptGiven ? operands.slice(1) : operands).filter((f) => f !== "-"));
  };
  for (const w of all) {
    if (OPERATORS.has(w)) flush();
    else segment.push(w);
  }
  flush();
  return files;
}
