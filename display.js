const chalk = require("chalk");

function printNode(node, indent = 0, isLast = true) {
  const prefix =
    indent === 0 ? "" : "  ".repeat(indent - 1) + (isLast ? "└─ " : "├─ ");
  const statusColor =
    {
      active: chalk.green,
      completed: chalk.gray,
      trimmed: chalk.dim,
    }[node.status] || chalk.white;

  const name = statusColor(node.name || "unnamed");
  const id = chalk.dim(`(${node._id})`);
  console.log(prefix + name + "  " + id);

  const children = node.children || [];
  children.forEach((child, i) => {
    printNode(child, indent + 1, i === children.length - 1);
  });
}

function printTable(rows, cols) {
  // rows: array of objects; cols: array of { key, label, width }
  const header = cols.map((c) => c.label.padEnd(c.width)).join("  ");
  console.log(chalk.bold(header));
  console.log(chalk.dim("─".repeat(header.length)));
  rows.forEach((row) => {
    const line = cols
      .map((c) => {
        const val = String(row[c.key] ?? "");
        return val.length > c.width
          ? val.slice(0, c.width - 1) + "…"
          : val.padEnd(c.width);
      })
      .join("  ");
    console.log(line);
  });
}

function printNotes(notes) {
  if (!notes.length) {
    console.log(chalk.dim("  (no notes)"));
    return;
  }
  notes.forEach((n, i) => {
    const ts = n.createdAt
      ? chalk.dim(new Date(n.createdAt).toLocaleString())
      : "";
    console.log(`  ${chalk.cyan(i + 1 + ".")} ${chalk.dim(n._id)}  ${ts}`);
    if (n.content) console.log(`     ${n.content.slice(0, 120)}`);
  });
}

module.exports = { printNode, printTable, printNotes };
