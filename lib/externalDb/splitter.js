// SQL statement splitter shared by init-db and external DB restore flows.
// Respects single/double/backtick quoted strings and backslash escapes.

function splitSqlStatements(sql) {
  const lines = sql.split('\n').filter((l) => {
    const t = l.trim();
    return !(t.startsWith('--') || t.startsWith('#'));
  });
  const src = lines.join('\n');
  const stmts = [];
  let cur = '';
  let inS = false, inD = false, inB = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "'" && !inD && !inB) {
      if (inS && src[i + 1] === "'") { cur += "''"; i++; continue; }
      inS = !inS;
    } else if (ch === '"' && !inS && !inB) {
      inD = !inD;
    } else if (ch === '`' && !inS && !inD) {
      inB = !inB;
    } else if (ch === '\\' && (inS || inD)) {
      cur += ch + (src[i + 1] || '');
      i++;
      continue;
    }
    if (ch === ';' && !inS && !inD && !inB) {
      if (cur.trim()) stmts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) stmts.push(cur.trim());
  return stmts;
}

// mysqldump output wraps routines/triggers in DELIMITER blocks which plain
// statement execution cannot handle — strip those blocks (they are skipped
// and reported by the restore flow).
function stripMysqlDelimiterBlocks(sql) {
  const lines = sql.split('\n');
  const out = [];
  let insideBlock = false;
  for (const line of lines) {
    const t = line.trim();
    if (/^DELIMITER/i.test(t)) {
      insideBlock = !/^DELIMITER\s*;?\s*$/i.test(t);
      continue;
    }
    if (insideBlock) continue;
    out.push(line);
  }
  return out.join('\n');
}

// Split a T-SQL script on GO batch separators (SSMS/pg_dump style exports).
function splitMssqlBatches(sql) {
  return sql
    .split(/^\s*GO\s*$/im)
    .map((b) => b.trim())
    .filter(Boolean);
}

module.exports = { splitSqlStatements, stripMysqlDelimiterBlocks, splitMssqlBatches };
