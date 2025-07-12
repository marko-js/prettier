type SimplePattern = {
  match: RegExp;
  until?: undefined;
  patterns?: undefined;
};

type NestedPattern = {
  match: RegExp;
  until: RegExp;
  patterns: Pattern[];
};

type Pattern = SimplePattern | NestedPattern;
const enclosedPatterns: Pattern[] = [];
enclosedPatterns.push(
  {
    // Ignored
    match: /[a-z0-9_$#@.]+/iy,
  },
  {
    // Line comments
    match: /\/\/.*$/y,
  },
  {
    // Multi line comments
    match: /\/\*.*?\*\//y,
  },
  {
    // Parens
    match: /\s*\(/y,
    patterns: enclosedPatterns,
    until: /\)/y,
  },
  {
    // Braces
    match: /\s*{/y,
    patterns: enclosedPatterns,
    until: /}/y,
  },
  {
    // Brackets
    match: /\s*\[/y,
    patterns: enclosedPatterns,
    until: /]/y,
  },
  {
    // Single quote string
    match: /'(?:\\.|[^'\\])*'/y,
  },
  {
    // Double quote string
    match: /"(?:\\.|[^"\\])*"/y,
  },
  {
    // Template literal
    match: /`/y,
    patterns: [
      {
        // Content
        match: /\\.|\$(?!{)|[^`\\$]+/y,
      },
      {
        // Expressions
        match: /\${/y,
        patterns: enclosedPatterns,
        until: /}/y,
      },
    ],
    until: /`/y,
  },
  {
    // RegExp
    match: /\/(?:\\.|\[(?:\\.|[^\]\\]+)\]|[^[/\\])+\/[a-z]*/iy,
  },
);

const unenclosedPatterns: Pattern[] = [
  {
    // Word operators
    match:
      /\b\s*(?:as|async|await|class|function|in(?:stanceof)?|new|void|delete|keyof|typeof|satisfies|extends)(?:\s+|\b)/y,
  },
  {
    // Symbol operators
    match:
      /\s*(?:[\^~%!]|\+{1,2}|\*{1,2}|-(?:-(?!\s))?|&{1,2}|\|{1,2}|!={0,2}|===?|<{1,3}|>{2,3}|<=?|=>)\s*/y,
  },
].concat(enclosedPatterns);

export default function outerCodeMatches(
  str: string,
  test: RegExp,
  enclosed?: boolean,
) {
  const stack: NestedPattern[] = [
    {
      until: test,
      patterns: enclosed ? enclosedPatterns : unenclosedPatterns,
    } as NestedPattern,
  ];
  let pos = 0;

  do {
    const { until, patterns } = stack[stack.length - 1];
    outer: while (pos < str.length) {
      for (const pattern of patterns) {
        pattern.match.lastIndex = pos;
        if (pattern.match.test(str)) {
          pos = pattern.match.lastIndex;
          if (pattern.until) {
            stack.push(pattern);
            break outer;
          } else {
            continue outer;
          }
        }
      }

      until.lastIndex = pos;
      if (until.test(str)) {
        pos = until.lastIndex;
        if (stack.length === 1) return true;
        stack.pop();
        break;
      }

      pos++;
    }
  } while (pos < str.length && stack.length);

  return false;
}
