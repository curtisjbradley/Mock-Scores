var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../node_modules/s-expression/index.js
var require_s_expression = __commonJS({
  "../node_modules/s-expression/index.js"(exports, module) {
    "use strict";
    function SParser(stream) {
      this._line = this._col = this._pos = 0;
      this._stream = stream;
    }
    SParser.not_whitespace_or_end = /^(\S|$)/;
    SParser.space_quote_paren_escaped_or_end = /^(\s|\\|"|'|`|,|\(|\)|$)/;
    SParser.string_or_escaped_or_end = /^(\\|"|$)/;
    SParser.string_delimiters = /["]/;
    SParser.quotes = /['`,]/;
    SParser.quotes_map = {
      "'": "quote",
      "`": "quasiquote",
      ",": "unquote"
    };
    SParser.prototype = {
      peek,
      consume,
      until,
      error,
      string,
      atom,
      quoted,
      expr,
      list
    };
    module.exports = function SParse(stream) {
      var parser = new SParse.Parser(stream);
      var expression = parser.expr();
      if (expression instanceof Error) {
        return expression;
      }
      if (parser.peek() != "") {
        return parser.error("Superfluous characters after expression: `" + parser.peek() + "`");
      }
      return expression;
    };
    module.exports.Parser = SParser;
    module.exports.SyntaxError = Error;
    function error(msg) {
      var e = new Error("Syntax error: " + msg);
      e.line = this._line + 1;
      e.col = this._col + 1;
      return e;
    }
    function peek() {
      if (this._stream.length == this._pos) return "";
      return this._stream[this._pos];
    }
    function consume() {
      if (this._stream.length == this._pos) return "";
      var c = this._stream[this._pos];
      this._pos += 1;
      if (c == "\r") {
        if (this.peek() == "\n") {
          this._pos += 1;
          c += "\n";
        }
        this._line++;
        this._col = 0;
      } else if (c == "\n") {
        this._line++;
        this._col = 0;
      } else {
        this._col++;
      }
      return c;
    }
    function until(regex) {
      var s = "";
      while (!regex.test(this.peek())) {
        s += this.consume();
      }
      return s;
    }
    function string() {
      var delimiter = this.consume();
      var str = "";
      while (true) {
        str += this.until(SParser.string_or_escaped_or_end);
        var next = this.peek();
        if (next == "") {
          return this.error("Unterminated string literal");
        }
        if (next == delimiter) {
          this.consume();
          break;
        }
        if (next == "\\") {
          this.consume();
          next = this.peek();
          if (next == "r") {
            this.consume();
            str += "\r";
          } else if (next == "t") {
            this.consume();
            str += "	";
          } else if (next == "n") {
            this.consume();
            str += "\n";
          } else if (next == "f") {
            this.consume();
            str += "\f";
          } else if (next == "b") {
            this.consume();
            str += "\b";
          } else {
            str += this.consume();
          }
          continue;
        }
        str += this.consume();
      }
      return new String(str);
    }
    function atom() {
      if (SParser.string_delimiters.test(this.peek())) {
        return this.string();
      }
      var atom2 = "";
      while (true) {
        atom2 += this.until(SParser.space_quote_paren_escaped_or_end);
        var next = this.peek();
        if (next == "\\") {
          this.consume();
          atom2 += this.consume();
          continue;
        }
        break;
      }
      return atom2;
    }
    function quoted() {
      var q = this.consume();
      var quote2 = SParser.quotes_map[q];
      if (quote2 == "unquote" && this.peek() == "@") {
        this.consume();
        quote2 = "unquote-splicing";
        q = ",@";
      }
      this.until(SParser.not_whitespace_or_end);
      var quotedExpr = this.expr();
      if (quotedExpr instanceof Error) {
        return quotedExpr;
      }
      if (quotedExpr === "") {
        return this.error("Unexpected `" + this.peek() + "` after `" + q + "`");
      }
      return [quote2, quotedExpr];
    }
    function expr() {
      this.until(SParser.not_whitespace_or_end);
      if (SParser.quotes.test(this.peek())) {
        return this.quoted();
      }
      var expr2 = this.peek() == "(" ? this.list() : this.atom();
      this.until(SParser.not_whitespace_or_end);
      return expr2;
    }
    function list() {
      if (this.peek() != "(") {
        return this.error("Expected `(` - saw `" + this.peek() + "` instead.");
      }
      this.consume();
      var ls = [];
      var v = this.expr();
      if (v instanceof Error) {
        return v;
      }
      if (v !== "") {
        ls.push(v);
        while ((v = this.expr()) !== "") {
          if (v instanceof Error) return v;
          ls.push(v);
        }
      }
      if (this.peek() != ")") {
        return this.error("Expected `)` - saw: `" + this.peek() + "`");
      }
      this.consume();
      return ls;
    }
  }
});

// src/organizer/blockly/standingsDsl.ts
var import_s_expression = __toESM(require_s_expression(), 1);
var DslError = class extends Error {
};
var AGGS = /* @__PURE__ */ new Set(["sum", "avg", "max", "min", "count"]);
var ORDERS = /* @__PURE__ */ new Set(["asc", "desc"]);
function isList(n) {
  return Array.isArray(n);
}
function isStringLiteral(n) {
  return n instanceof String;
}
function isAtom(n) {
  return typeof n === "string";
}
function nameOf(n, what) {
  if (n === void 0) throw new DslError(`Expected ${what}`);
  if (isStringLiteral(n)) return n.toString();
  if (isAtom(n)) return n;
  throw new DslError(`Expected ${what} to be a name, got a list`);
}
function keyword(n, what) {
  if (n !== void 0 && isAtom(n)) return n;
  throw new DslError(`Expected keyword for ${what}`);
}
function head(list, what) {
  const h = list[0];
  if (!isAtom(h)) throw new DslError(`Expected ${what} to start with a keyword`);
  return h;
}
var ARITH = { "+": "+", "-": "-", "*": "*", "/": "/", "**": "**" };
var COMPARE = { "=": "===", "!=": "!==", "<": "<", "<=": "<=", ">": ">", ">=": ">=" };
var MATH_FN = {
  sqrt: "Math.sqrt",
  abs: "Math.abs",
  neg: "-",
  ln: "Math.log",
  log10: "Math.log10",
  exp: "Math.exp",
  pow10: "(x=>Math.pow(10,x))"
};
function exprToJs(node) {
  if (isAtom(node)) {
    if (node !== "" && !Number.isNaN(Number(node))) return String(Number(node));
    throw new DslError(`Unexpected symbol "${node}" in expression; did you mean a (pairing ${node}) / (stat "${node}") form?`);
  }
  if (isStringLiteral(node)) {
    throw new DslError(`Unexpected string literal "${node}" in expression`);
  }
  const list = node;
  if (list.length === 0) throw new DslError("Empty expression");
  const op = head(list, "expression");
  switch (op) {
    case "pairing":
    case "ballot":
      return `p.${keyword(list[1], `${op} field`)}`;
    case "team":
      return `stats['${keyword(list[1], "team field")}']`;
    case "stat":
      return `stats['${nameOf(list[1], "stat name")}']`;
    case "intermediate":
      return `intermediate['${nameOf(list[1], "intermediate name")}']`;
    case "opponent":
      return `opponent['${nameOf(list[1], "opponent stat name")}']`;
    case "+":
    case "-":
    case "*":
    case "/":
    case "**":
      return `(${exprToJs(list[1])} ${ARITH[op]} ${exprToJs(list[2])})`;
    case "=":
    case "!=":
    case "<":
    case "<=":
    case ">":
    case ">=":
      return `(${exprToJs(list[1])} ${COMPARE[op]} ${exprToJs(list[2])} ? 1 : 0)`;
    case "and":
      return `((${exprToJs(list[1])} && ${exprToJs(list[2])}) ? 1 : 0)`;
    case "or":
      return `((${exprToJs(list[1])} || ${exprToJs(list[2])}) ? 1 : 0)`;
    case "if":
      return `(${exprToJs(list[1])} ? ${exprToJs(list[2])} : ${exprToJs(list[3])})`;
    case "sqrt":
    case "abs":
    case "neg":
    case "ln":
    case "log10":
    case "exp":
    case "pow10":
      return `${MATH_FN[op]}(${exprToJs(list[1])})`;
    default:
      throw new DslError(`Unknown expression operator "${op}"`);
  }
}
function lexJs(s) {
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " ") {
      i++;
      continue;
    }
    if (s.startsWith("(x=>Math.pow(10,x))", i)) {
      toks.push({ t: "fn", v: "pow10" });
      i += "(x=>Math.pow(10,x))".length;
      continue;
    }
    if (c === "(" || c === ")") {
      toks.push({ t: c, v: c });
      i++;
      continue;
    }
    if (c === "?" || c === ":") {
      toks.push({ t: c, v: c });
      i++;
      continue;
    }
    if (s.startsWith("===", i)) {
      toks.push({ t: "op", v: "===" });
      i += 3;
      continue;
    }
    if (s.startsWith("!==", i)) {
      toks.push({ t: "op", v: "!==" });
      i += 3;
      continue;
    }
    if (s.startsWith("**", i)) {
      toks.push({ t: "op", v: "**" });
      i += 2;
      continue;
    }
    if (s.startsWith("<=", i)) {
      toks.push({ t: "op", v: "<=" });
      i += 2;
      continue;
    }
    if (s.startsWith(">=", i)) {
      toks.push({ t: "op", v: ">=" });
      i += 2;
      continue;
    }
    if (s.startsWith("&&", i)) {
      toks.push({ t: "op", v: "&&" });
      i += 2;
      continue;
    }
    if (s.startsWith("||", i)) {
      toks.push({ t: "op", v: "||" });
      i += 2;
      continue;
    }
    if (c === "-" && s[i + 1] === "(") {
      toks.push({ t: "fn", v: "neg" });
      i++;
      continue;
    }
    if ("+-*/<>".includes(c)) {
      toks.push({ t: "op", v: c });
      i++;
      continue;
    }
    if (s.startsWith("p.", i)) {
      let j = i + 2;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      toks.push({ t: "pfield", v: s.slice(i + 2, j) });
      i = j;
      continue;
    }
    const dictMatch = /^(stats|intermediate|opponent)\['([^']*)'\]/.exec(s.slice(i));
    if (dictMatch) {
      toks.push({ t: "dict", v: `${dictMatch[1]}:${dictMatch[2]}` });
      i += dictMatch[0].length;
      continue;
    }
    const fnMatch = /^Math\.(sqrt|abs|log10|log|exp)/.exec(s.slice(i));
    if (fnMatch) {
      const map = { sqrt: "sqrt", abs: "abs", log10: "log10", log: "ln", exp: "exp" };
      toks.push({ t: "fn", v: map[fnMatch[1]] });
      i += fnMatch[0].length;
      continue;
    }
    const numMatch = /^-?\d+(\.\d+)?/.exec(s.slice(i));
    if (numMatch) {
      toks.push({ t: "num", v: numMatch[0] });
      i += numMatch[0].length;
      continue;
    }
    throw new DslError(`Cannot serialize expression near "${s.slice(i, i + 12)}"`);
  }
  return toks;
}
var JsExprReader = class {
  i = 0;
  toks;
  constructor(toks) {
    this.toks = toks;
  }
  peek() {
    return this.toks[this.i];
  }
  next() {
    return this.toks[this.i++];
  }
  expect(t) {
    const tok = this.next();
    if (!tok || tok.t !== t) throw new DslError(`Expected "${t}" while reading expression`);
    return tok;
  }
  read() {
    const node = this.readNode();
    if (this.i !== this.toks.length) throw new DslError("Trailing tokens in expression");
    return node;
  }
  readNode() {
    const tok = this.peek();
    if (!tok) throw new DslError("Unexpected end of expression");
    switch (tok.t) {
      case "num":
        this.next();
        return tok.v;
      case "pfield":
        this.next();
        return `(pairing ${tok.v})`;
      case "dict": {
        this.next();
        const [dict, name] = tok.v.split(/:(.*)/s);
        if (dict === "stats") {
          return /^[a-z][a-z0-9_]*$/.test(name) ? `(team ${name})` : `(stat "${name}")`;
        }
        if (dict === "intermediate") return `(intermediate "${name}")`;
        return `(opponent "${name}")`;
      }
      case "fn": {
        this.next();
        this.expect("(");
        const arg = this.readNode();
        this.expect(")");
        return `(${tok.v} ${arg})`;
      }
      case "(": {
        this.next();
        const first = this.readNode();
        const opTok = this.peek();
        if (opTok && opTok.t === "?") {
          this.next();
          const then = this.readNode();
          this.expect(":");
          const els = this.readNode();
          this.expect(")");
          return this.reconstructConditional(first, then, els);
        }
        if (opTok && opTok.t === "op") {
          this.next();
          const right = this.readNode();
          const after = this.peek();
          if (after && after.t === "?") {
            this.next();
            this.readNode();
            this.expect(":");
            this.readNode();
            this.expect(")");
            return this.wrapCompareOrLogic(opTok.v, first, right);
          }
          this.expect(")");
          if (opTok.v === "&&" || opTok.v === "||") return this.wrapCompareOrLogic(opTok.v, first, right);
          return `(${this.arithSym(opTok.v)} ${first} ${right})`;
        }
        this.expect(")");
        return first;
      }
      default:
        throw new DslError(`Unexpected token "${tok.v}" in expression`);
    }
  }
  arithSym(op) {
    const map = { "+": "+", "-": "-", "*": "*", "/": "/", "**": "**" };
    if (!map[op]) throw new DslError(`Unexpected arithmetic operator "${op}"`);
    return map[op];
  }
  wrapCompareOrLogic(op, a, b) {
    const cmp = { "===": "=", "!==": "!=", "<": "<", "<=": "<=", ">": ">", ">=": ">=" };
    if (cmp[op]) return `(${cmp[op]} ${a} ${b})`;
    if (op === "&&") return `(and ${a} ${b})`;
    if (op === "||") return `(or ${a} ${b})`;
    throw new DslError(`Unexpected operator "${op}"`);
  }
  reconstructConditional(cond, then, els) {
    if (then === "1" && els === "0" && /^\((=|!=|<|<=|>|>=|and|or) /.test(cond)) return cond;
    return `(if ${cond} ${then} ${els})`;
  }
};
function jsExprToDsl(expr) {
  return new JsExprReader(lexJs(expr)).read();
}
function parseDsl(text) {
  if (!text || !text.trim()) return { statDefs: [], columns: [], tiebreakers: [] };
  const parsed = (0, import_s_expression.default)(text);
  if (parsed instanceof Error) throw new DslError(`DSL parse error: ${parsed.message}`);
  if (!isList(parsed)) throw new DslError("DSL must be a (config ...) form");
  if (head(parsed, "config") !== "config") throw new DslError("DSL must start with (config ...)");
  const statDefs = [];
  const columns = [];
  const tiebreakers = [];
  for (const form of parsed.slice(1)) {
    if (!isList(form)) throw new DslError("Each config entry must be a list");
    const kind = head(form, "config entry");
    switch (kind) {
      case "stat": {
        const name = nameOf(form[1], "stat name");
        const agg = keyword(form[2], "aggregation");
        if (!AGGS.has(agg)) throw new DslError(`Invalid aggregation "${agg}"`);
        statDefs.push({ name, agg, expr: exprToJs(form[3]) });
        break;
      }
      case "team-stat": {
        const name = nameOf(form[1], "team-stat name");
        statDefs.push({ name, agg: "sum", expr: exprToJs(form[2]), teamLevel: true });
        break;
      }
      case "intermediate": {
        const name = nameOf(form[1], "intermediate name");
        const agg = keyword(form[2], "aggregation");
        if (!AGGS.has(agg)) throw new DslError(`Invalid aggregation "${agg}"`);
        statDefs.push({ name, agg, expr: exprToJs(form[3]), intermediate: true });
        break;
      }
      case "trimmed": {
        const name = nameOf(form[1], "trimmed stat name");
        const agg = keyword(form[2], "aggregation");
        if (!AGGS.has(agg)) throw new DslError(`Invalid aggregation "${agg}"`);
        const trim = Number(keyword(form[3], "trim count"));
        if (Number.isNaN(trim)) throw new DslError("trim count must be a number");
        statDefs.push({ name, agg, expr: exprToJs(form[4]), trim });
        break;
      }
      case "columns": {
        for (const col of form.slice(1)) {
          if (!isList(col) || head(col, "column") !== "column")
            throw new DslError('columns entries must be (column "Stat" "Label")');
          const stat = nameOf(col[1], "column stat");
          const label = col[2] !== void 0 ? nameOf(col[2], "column label") : stat;
          columns.push({ stat, label: label || stat });
        }
        break;
      }
      case "tiebreakers": {
        for (const tb of form.slice(1)) {
          if (!isList(tb)) throw new DslError("tiebreakers entries must be lists");
          const tbKind = head(tb, "tiebreaker");
          const stat = nameOf(tb[1], "tiebreaker stat");
          const order = keyword(tb[2], "order");
          if (!ORDERS.has(order)) throw new DslError(`Invalid order "${order}"`);
          if (tbKind === "by") tiebreakers.push({ type: "stat", stat, order });
          else if (tbKind === "h2h") tiebreakers.push({ type: "h2h_conditional", stat, order });
          else throw new DslError(`Unknown tiebreaker "${tbKind}"`);
        }
        break;
      }
      default:
        throw new DslError(`Unknown config entry "${kind}"`);
    }
  }
  return { statDefs, columns, tiebreakers };
}
function quote(name) {
  return `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
function serializeStat(def) {
  const body = jsExprToDsl(def.expr);
  if (def.teamLevel) return `  (team-stat ${quote(def.name)} ${body})`;
  if (def.intermediate) return `  (intermediate ${quote(def.name)} ${def.agg} ${body})`;
  if (def.trim !== void 0) return `  (trimmed ${quote(def.name)} ${def.agg} ${def.trim} ${body})`;
  return `  (stat ${quote(def.name)} ${def.agg} ${body})`;
}
function serializeConfig(config) {
  const lines = ["(config"];
  for (const def of config.statDefs) lines.push(serializeStat(def));
  if (config.columns.length) {
    const cols = config.columns.map((c) => `(column ${quote(c.stat)} ${quote(c.label)})`).join(" ");
    lines.push(`  (columns ${cols})`);
  } else {
    lines.push("  (columns)");
  }
  if (config.tiebreakers.length) {
    const tbs = config.tiebreakers.map((t) => t.type === "h2h_conditional" ? `(h2h ${quote(t.stat)} ${t.order})` : `(by ${quote(t.stat)} ${t.order})`).join(" ");
    lines.push(`  (tiebreakers ${tbs})`);
  } else {
    lines.push("  (tiebreakers)");
  }
  return lines.join("\n") + ")";
}

// src/organizer/blockly/standingsEngine.ts
function pairingCtx(p) {
  const bw = p.ballots.filter((b) => b.pointsFor > b.pointsAgainst).length;
  const bl = p.ballots.filter((b) => b.pointsFor < b.pointsAgainst).length;
  const bt = p.ballots.length - bw - bl;
  const pf = p.ballots.reduce((s, b) => s + b.pointsFor, 0);
  const pa = p.ballots.reduce((s, b) => s + b.pointsAgainst, 0);
  const pd = p.ballots.reduce((s, b) => s + (b.pointsFor - b.pointsAgainst), 0);
  const nb = p.ballots.length;
  return {
    ballots_won: bw,
    ballots_lost: bl,
    ballots_tied: bt,
    points_for: pf,
    points_against: pa,
    won_presider_tb: p.won_presider_tiebreaker ? 1 : 0,
    ballot_pf: pf,
    ballot_pa: pa,
    ballot_pd: pd,
    ballot_raw: pf,
    num_ballots: nb,
    num_scorers: p.num_scorers
  };
}
function evalExpr(expr, p, stats, opponent, intermediate) {
  try {
    return Number(new Function("p", "stats", "opponent", "intermediate", `return ${expr}`)(p, stats, opponent, intermediate));
  } catch {
    return 0;
  }
}
function aggregate(values, agg, trim = 0) {
  let v = [...values];
  if (trim > 0 && v.length > trim * 2) {
    v.sort((a, b) => a - b);
    v = v.slice(trim, v.length - trim);
  }
  if (!v.length) return 0;
  switch (agg) {
    case "sum":
      return v.reduce((a, b) => a + b, 0);
    case "avg":
      return v.reduce((a, b) => a + b, 0) / v.length;
    case "max":
      return Math.max(...v);
    case "min":
      return Math.min(...v);
    case "count":
      return v.filter((x) => x !== 0).length;
  }
}
function computeTeamStats(team, statDefs, teamStatsByCode) {
  const ctxs = team.pairings.map(pairingCtx);
  const builtins = {
    ballots_won: ctxs.reduce((s, c) => s + c.ballots_won, 0),
    ballots_lost: ctxs.reduce((s, c) => s + c.ballots_lost, 0),
    ballots_tied: ctxs.reduce((s, c) => s + c.ballots_tied, 0),
    points_for: ctxs.reduce((s, c) => s + c.points_for, 0),
    points_against: ctxs.reduce((s, c) => s + c.points_against, 0),
    won_presider_tb: ctxs.reduce((s, c) => s + c.won_presider_tb, 0),
    ballot_pf: ctxs.reduce((s, c) => s + c.ballot_pf, 0),
    ballot_pa: ctxs.reduce((s, c) => s + c.ballot_pa, 0),
    ballot_pd: ctxs.reduce((s, c) => s + c.ballot_pd, 0),
    ballot_raw: ctxs.reduce((s, c) => s + c.ballot_raw, 0),
    num_scorers: ctxs.reduce((s, c) => s + c.num_scorers, 0),
    // Team-level primitive: how many pairings this team played.
    num_pairings: team.pairings.length
  };
  const stats = { ...builtins };
  for (const def of statDefs) {
    if (def.teamLevel) {
      stats[def.name] = evalExpr(def.expr, ctxs[0] ?? {}, stats, {}, {});
    } else if (def.intermediate) {
    } else {
      const values = team.pairings.map((p, i) => {
        const opponent = teamStatsByCode[p.opponent] ?? {};
        const intermediate = {};
        for (const iDef of statDefs.filter((d) => d.intermediate)) {
          intermediate[iDef.name] = evalExpr(iDef.expr, ctxs[i], stats, opponent, intermediate);
        }
        return evalExpr(def.expr, ctxs[i], stats, opponent, intermediate);
      });
      stats[def.name] = aggregate(values, def.agg, def.trim ?? 0);
    }
  }
  return { code: team.code, name: team.name, ...stats };
}
function h2hWinner(a, b, teams, statDefs, stat, order) {
  const teamA = teams.find((t) => t.code === a.code);
  if (!teamA) return 0;
  const pairing = teamA.pairings.find((p) => p.opponent === b.code);
  if (!pairing) return 0;
  const ctx = pairingCtx(pairing);
  const intermediate = {};
  for (const iDef of statDefs.filter((d) => d.intermediate)) {
    intermediate[iDef.name] = evalExpr(iDef.expr, ctx, a, b, intermediate);
  }
  const av = intermediate[stat] ?? ctx[stat] ?? 0;
  const teamB = teams.find((t) => t.code === b.code);
  const pairingB = teamB?.pairings.find((p) => p.opponent === a.code);
  const ctxB = pairingB ? pairingCtx(pairingB) : ctx;
  const intermediateB = {};
  for (const iDef of statDefs.filter((d) => d.intermediate)) {
    intermediateB[iDef.name] = evalExpr(iDef.expr, ctxB, b, a, intermediateB);
  }
  const bv = intermediateB[stat] ?? ctxB[stat] ?? 0;
  if (av !== bv) return order === "desc" ? bv - av : av - bv;
  return 0;
}
function sortByTiebreakers(rows2, rules, teams, statDefs) {
  return [...rows2].sort((a, b) => {
    for (const rule of rules) {
      if (rule.type === "h2h_conditional") {
        const r = h2hWinner(a, b, teams, statDefs, rule.stat, rule.order);
        if (r !== 0) return r;
      } else {
        const av = a[rule.stat] ?? 0;
        const bv = b[rule.stat] ?? 0;
        if (av !== bv) return rule.order === "desc" ? bv - av : av - bv;
      }
    }
    return 0;
  });
}
function computeStandings(teams, config) {
  const passes = Math.max(2, config.statDefs.length);
  let byCode = {};
  let rows2 = [];
  for (let i = 0; i < passes; i++) {
    rows2 = teams.map((t) => computeTeamStats(t, config.statDefs, byCode));
    byCode = {};
    for (const r of rows2) byCode[r.code] = r;
  }
  return sortByTiebreakers(rows2, config.tiebreakers, teams, config.statDefs);
}

// src/organizer/blockly/dummyTeams.ts
var dummyTeams = [
  {
    // 3 wins — tied with B on wins, beat B head-to-head
    name: "Team A",
    code: "A",
    pairings: [
      { opponent: "B", ballots: [{ pointsFor: 185, pointsAgainst: 172 }, { pointsFor: 180, pointsAgainst: 180 }], won_presider_tiebreaker: true, num_scorers: 2 },
      // ballot tie in game 2
      { opponent: "C", ballots: [{ pointsFor: 190, pointsAgainst: 165 }, { pointsFor: 188, pointsAgainst: 170 }], won_presider_tiebreaker: true, num_scorers: 2 },
      { opponent: "D", ballots: [{ pointsFor: 175, pointsAgainst: 182 }, { pointsFor: 173, pointsAgainst: 179 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: "E", ballots: [{ pointsFor: 183, pointsAgainst: 176 }, { pointsFor: 179, pointsAgainst: 174 }], won_presider_tiebreaker: true, num_scorers: 2 }
    ]
  },
  {
    // 3 wins — tied with A on wins, lost to A head-to-head
    name: "Team B",
    code: "B",
    pairings: [
      { opponent: "A", ballots: [{ pointsFor: 172, pointsAgainst: 185 }, { pointsFor: 180, pointsAgainst: 180 }], won_presider_tiebreaker: false, num_scorers: 2 },
      // ballot tie in game 2
      { opponent: "C", ballots: [{ pointsFor: 178, pointsAgainst: 178 }, { pointsFor: 182, pointsAgainst: 171 }], won_presider_tiebreaker: true, num_scorers: 2 },
      // ballot tie in game 1
      { opponent: "E", ballots: [{ pointsFor: 191, pointsAgainst: 168 }, { pointsFor: 187, pointsAgainst: 172 }], won_presider_tiebreaker: true, num_scorers: 2 },
      { opponent: "F", ballots: [{ pointsFor: 184, pointsAgainst: 169 }, { pointsFor: 180, pointsAgainst: 175 }], won_presider_tiebreaker: true, num_scorers: 2 }
    ]
  },
  {
    // 1 win
    name: "Team C",
    code: "C",
    pairings: [
      { opponent: "A", ballots: [{ pointsFor: 165, pointsAgainst: 190 }, { pointsFor: 170, pointsAgainst: 188 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: "B", ballots: [{ pointsFor: 178, pointsAgainst: 178 }, { pointsFor: 171, pointsAgainst: 182 }], won_presider_tiebreaker: false, num_scorers: 2 },
      // ballot tie in game 1
      { opponent: "D", ballots: [{ pointsFor: 186, pointsAgainst: 174 }, { pointsFor: 183, pointsAgainst: 170 }], won_presider_tiebreaker: true, num_scorers: 2 },
      { opponent: "F", ballots: [{ pointsFor: 168, pointsAgainst: 185 }, { pointsFor: 165, pointsAgainst: 190 }], won_presider_tiebreaker: false, num_scorers: 2 }
    ]
  },
  {
    // 4 wins — top team
    name: "Team D",
    code: "D",
    pairings: [
      { opponent: "A", ballots: [{ pointsFor: 182, pointsAgainst: 175 }, { pointsFor: 179, pointsAgainst: 173 }], won_presider_tiebreaker: true, num_scorers: 2 },
      { opponent: "C", ballots: [{ pointsFor: 174, pointsAgainst: 186 }, { pointsFor: 170, pointsAgainst: 183 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: "E", ballots: [{ pointsFor: 188, pointsAgainst: 171 }, { pointsFor: 185, pointsAgainst: 168 }], won_presider_tiebreaker: true, num_scorers: 2 },
      { opponent: "F", ballots: [{ pointsFor: 192, pointsAgainst: 163 }, { pointsFor: 189, pointsAgainst: 166 }], won_presider_tiebreaker: true, num_scorers: 2 }
    ]
  },
  {
    // 1 win — exactly tied with G on everything (same wins, same PF, same PA)
    name: "Team E",
    code: "E",
    pairings: [
      { opponent: "A", ballots: [{ pointsFor: 176, pointsAgainst: 183 }, { pointsFor: 174, pointsAgainst: 179 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: "B", ballots: [{ pointsFor: 168, pointsAgainst: 191 }, { pointsFor: 172, pointsAgainst: 187 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: "D", ballots: [{ pointsFor: 171, pointsAgainst: 188 }, { pointsFor: 168, pointsAgainst: 185 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: "G", ballots: [{ pointsFor: 180, pointsAgainst: 170 }, { pointsFor: 175, pointsAgainst: 165 }], won_presider_tiebreaker: true, num_scorers: 2 }
    ]
  },
  {
    // 2 wins
    name: "Team F",
    code: "F",
    pairings: [
      { opponent: "B", ballots: [{ pointsFor: 169, pointsAgainst: 184 }, { pointsFor: 175, pointsAgainst: 180 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: "C", ballots: [{ pointsFor: 185, pointsAgainst: 168 }, { pointsFor: 190, pointsAgainst: 165 }], won_presider_tiebreaker: true, num_scorers: 2 },
      { opponent: "D", ballots: [{ pointsFor: 163, pointsAgainst: 192 }, { pointsFor: 166, pointsAgainst: 189 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: "G", ballots: [{ pointsFor: 182, pointsAgainst: 171 }, { pointsFor: 178, pointsAgainst: 167 }], won_presider_tiebreaker: true, num_scorers: 2 }
    ]
  },
  {
    // 1 win — exactly tied with E on wins, PF, PA (perfect mirror)
    name: "Team G",
    code: "G",
    pairings: [
      { opponent: "E", ballots: [{ pointsFor: 170, pointsAgainst: 180 }, { pointsFor: 165, pointsAgainst: 175 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: "F", ballots: [{ pointsFor: 171, pointsAgainst: 182 }, { pointsFor: 167, pointsAgainst: 178 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: "C", ballots: [{ pointsFor: 177, pointsAgainst: 163 }, { pointsFor: 174, pointsAgainst: 160 }], won_presider_tiebreaker: true, num_scorers: 2 },
      { opponent: "D", ballots: [{ pointsFor: 160, pointsAgainst: 195 }, { pointsFor: 158, pointsAgainst: 192 }], won_presider_tiebreaker: false, num_scorers: 2 }
    ]
  }
];

// _slo_test.mjs
var SLO = `(config
  (intermediate "Win" sum (if (> (pairing points_for) (pairing points_against)) 1 (if (= (pairing points_for) (pairing points_against)) (pairing won_presider_tb) 0)))
  (stat "Wins" sum (intermediate "Win"))
  (team-stat "Pct" (/ (team points_for) (+ (team points_for) (team points_against))))
  (columns (column "Wins" "Wins") (column "Pct" "% Points"))
  (tiebreakers (by "Wins" desc) (h2h "Win" desc) (by "Pct" desc)))`;
function assert(c, m) {
  if (!c) {
    console.error("FAIL:", m);
    process.exit(1);
  }
}
var cfg = parseDsl(SLO);
for (const d of cfg.statDefs) console.log(d.name, "=>", d.expr, d.intermediate ? "[int]" : "", d.teamLevel ? "[team]" : "");
console.log("cols", JSON.stringify(cfg.columns));
console.log("tbs", JSON.stringify(cfg.tiebreakers));
assert(cfg.statDefs.find((d) => d.name === "Win")?.intermediate === true, "Win intermediate");
assert(cfg.statDefs.find((d) => d.name === "Pct")?.teamLevel === true, "Pct team");
assert(cfg.tiebreakers[0].type === "stat" && cfg.tiebreakers[0].stat === "Wins", "tb1 wins");
assert(cfg.tiebreakers[1].type === "h2h_conditional" && cfg.tiebreakers[1].stat === "Win", "tb2 h2h Win");
assert(cfg.tiebreakers[2].type === "stat" && cfg.tiebreakers[2].stat === "Pct", "tb3 pct");
var cfg2 = parseDsl(serializeConfig(cfg));
assert(JSON.stringify(cfg) === JSON.stringify(cfg2), "roundtrip\n" + serializeConfig(cfg));
var rows = computeStandings(dummyTeams, cfg);
console.log("\nStandings:");
for (const r of rows) console.log(" ", r.code, "Wins=", r["Wins"], "Pct=", typeof r["Pct"] === "number" ? r["Pct"].toFixed(4) : r["Pct"]);
for (const r of rows) {
  assert(typeof r["Wins"] === "number" && !Number.isNaN(r["Wins"]), `Wins numeric ${r.code}`);
  assert(typeof r["Pct"] === "number" && !Number.isNaN(r["Pct"]), `Pct numeric ${r.code}`);
}
console.log("\nSLO DSL OK");
console.log("\nSerialized:\n" + serializeConfig(cfg));
