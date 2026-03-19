#!/usr/bin/env node

const { Command } = require("commander");
const chalk = require("chalk");
const TreeAPI = require("./api");
const { version } = require("./package.json");
const {
  load,
  save,
  requireAuth,
  currentNodeId,
  currentPath,
} = require("./config");
const { printNode, printTable, printNotes, printContributions, printChats, printBook } = require("./display");

/**
 * Parse friendly date strings into ISO 8601.
 * Accepts: "01/22/2025 5:45pm", "01/22/2025 17:45", "2025-01-22T17:45:00Z", etc.
 */
function parseDate(input) {
  // Already ISO 8601
  if (/^\d{4}-\d{2}-\d{2}T/.test(input)) return input;

  // MM/DD/YYYY with optional time → defaults to midnight
  const mDate = input.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(am|pm)?)?$/i,
  );
  if (mDate) {
    const [, month, day, year, rawHour, min, ampm] = mDate;
    let hour = rawHour ? parseInt(rawHour, 10) : 0;
    const minute = min ? parseInt(min, 10) : 0;
    if (ampm) {
      const ap = ampm.toLowerCase();
      if (ap === "pm" && hour < 12) hour += 12;
      if (ap === "am" && hour === 12) hour = 0;
    }
    const d = new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      hour,
      minute,
    );
    return d.toISOString();
  }

  // Time only (e.g. "5:45pm", "17:45") → defaults to today
  const mTime = input.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (mTime) {
    const [, rawHour, min, ampm] = mTime;
    let hour = parseInt(rawHour, 10);
    const minute = parseInt(min, 10);
    if (ampm) {
      const ap = ampm.toLowerCase();
      if (ap === "pm" && hour < 12) hour += 12;
      if (ap === "am" && hour === 12) hour = 0;
    }
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
    return d.toISOString();
  }

  // Fallback — let JS try to parse it
  const d = new Date(input);
  if (isNaN(d.getTime())) throw new Error(`Cannot parse date: "${input}"`);
  return d.toISOString();
}

const program = new Command();

/**
 * Find a child by name or ID (prefix match).
 * - If `query` matches exactly one child by name → return it.
 * - If `query` matches a child _id (or prefix of one) → return it.
 * - If multiple children share the same name → print disambiguation and return null.
 * - If nothing matches → print error and return null.
 */
/** Extract children array from a getNode API response */
function getChildren(data) {
  const node = data.node || data;
  return node.children || [];
}

// Flatten a full tree into [{node, pathStack}] entries for tree-wide search
function flattenTree(node, pathStack = []) {
  const results = [];
  const entry = { node, pathStack: [...pathStack, { id: node._id, name: node.name }] };
  results.push(entry);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (child && typeof child === "object" && child._id) {
        results.push(...flattenTree(child, entry.pathStack));
      }
    }
  }
  return results;
}

function findChild(children, query) {
  const q = query.toLowerCase();

  // Exact ID match
  const byId = children.find((c) => c._id === query);
  if (byId) return byId;

  // ID prefix match
  const byIdPrefix = children.filter((c) => c._id.startsWith(query));
  if (byIdPrefix.length === 1) return byIdPrefix[0];

  // Exact name match (case-insensitive)
  const byName = children.filter((c) => c.name && c.name.toLowerCase() === q);
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) {
    console.error(
      chalk.yellow(`Multiple matches for "${query}". Use an ID to disambiguate (tip: rename one with: rename <name> <newname>):`),
    );
    byName.forEach((c) =>
      console.log(`  ${chalk.cyan(c.name)}  ${chalk.dim(c._id)}`),
    );
    return null;
  }

  // Partial name match — name starts with query
  const byStart = children.filter((c) => c.name && c.name.toLowerCase().startsWith(q));
  if (byStart.length === 1) return byStart[0];
  if (byStart.length > 1) {
    console.error(
      chalk.yellow(`Multiple matches for "${query}". Use an ID to disambiguate (tip: rename one with: rename <name> <newname>):`),
    );
    byStart.forEach((c) =>
      console.log(`  ${chalk.cyan(c.name)}  ${chalk.dim(c._id)}`),
    );
    return null;
  }

  // Substring match — query appears anywhere in name
  const bySub = children.filter((c) => c.name && c.name.toLowerCase().includes(q));
  if (bySub.length === 1) return bySub[0];
  if (bySub.length > 1) {
    console.error(
      chalk.yellow(`Multiple matches for "${query}". Use an ID to disambiguate (tip: rename one with: rename <name> <newname>):`),
    );
    bySub.forEach((c) =>
      console.log(`  ${chalk.cyan(c.name)}  ${chalk.dim(c._id)}`),
    );
    return null;
  }

  // Nothing found
  console.error(chalk.red(`No child matching "${query}"`));
  const list = children.map((c) => `  ${chalk.cyan(c.name)}  ${chalk.dim(c._id)}`).join("\n");
  if (list) console.log("Children:\n" + list);
  return null;
}

program
  .name("treef")
  .description(
    "CLI for Tree — navigate and manage your nodes like a filesystem",
  )
  .version(version)
  .addHelpText("afterAll", "")
  .configureHelp({
    formatHelp(cmd, helper) {
      const sections = [
        {
          title: "Getting Started",
          cmds: ["start", "stop", "shell", "login", "logout", "whoami"],
        },
        {
          title: "User Home (no tree required)",
          cmds: ["roots", "use", "root", "mkroot", "home", "ideas", "idea", "idea-store", "rm-idea", "idea-place", "idea-auto", "idea-transfer", "contributions", "share-token", "share", "link"],
        },
        {
          title: "Navigation (inside a tree)",
          cmds: ["pwd", "ls", "cd", "tree", "calendar", "dream-time"],
        },
        {
          title: "Node Management",
          cmds: ["mkdir", "rm", "mv", "rename", "status", "schedule", "prestige"],
        },
        {
          title: "Notes & Values",
          cmds: ["note", "notes", "rm-note", "book", "contributions", "values", "value", "goal"],
        },
        {
          title: "AI",
          cmds: ["chat", "chats", "place", "query"],
        },
        {
          title: "Understanding Runs",
          cmds: ["understand", "understandings", "understand-status", "understand-stop"],
        },
        {
          title: "Blog",
          cmds: ["blogs", "blog"],
        },
      ];

      const cmdMap = {};
      cmd.commands.forEach((c) => {
        cmdMap[c.name()] = c;
      });

      let out = `Usage: ${helper.commandUsage(cmd)}\n\n`;
      out += `What is Tree?\n`;
      out += `  A living structure for everything you're building, thinking, and tracking.\n`;
      out += `  Organize knowledge into trees of nodes, each with history, AI context,\n`;
      out += `  goals, and values. Navigate and manage your trees from the terminal.\n\n`;
      out += `  https://tree.tabors.site/about\n\n`;
      out += `  Docs:\n`;
      out += `    Getting Started    https://tree.tabors.site/about/gettingstarted\n`;
      out += `    Raw Ideas          https://tree.tabors.site/about/raw-ideas\n`;
      out += `    Energy System      https://tree.tabors.site/about/energy\n`;
      out += `    Tree Dreams        https://tree.tabors.site/about/dreams\n`;
      out += `    CLI                https://tree.tabors.site/about/cli\n`;
      out += `    Gateway            https://tree.tabors.site/about/gateway\n`;
      out += `    API Reference      https://tree.tabors.site/about/api\n`;
      out += `    Blog               https://tree.tabors.site/blog\n\n`;

      const fmtUsage = (c) => {
        return (c.name() + " " + c.usage()).replace(/ \[options\]/g, "").trim();
      };

      for (const section of sections) {
        out += `${section.title}:\n`;
        for (const name of section.cmds) {
          const c = cmdMap[name];
          if (!c) continue;
          out += `  ${fmtUsage(c)}\n`;
          out += `      ${c.description()}\n`;
          delete cmdMap[name];
        }
        out += "\n";
      }

      // Any remaining commands not in a section
      const remaining = Object.values(cmdMap);
      if (remaining.length) {
        out += "Other:\n";
        for (const c of remaining) {
          out += `  ${fmtUsage(c)}\n`;
          out += `      ${c.description()}\n`;
        }
        out += "\n";
      }

      out += `Options:\n`;
      out += `  -V, --version                       output the version number\n`;
      out += `  -h, --help                           display help for command\n`;

      return out;
    },
  });

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("login")
  .description("Authenticate with your API key")
  .requiredOption("--key <apiKey>", "Your Tree API key")
  .action(async ({ key }) => {
    try {
      const api = new TreeAPI(key);
      const me = await api.me();
      const cfg = load();
      cfg.apiKey = key;
      cfg.userId = me.userId;
      cfg.username = me.username;
      cfg.plan = me.profileType || null;
      cfg.planExpiresAt = me.planExpiresAt || null;
      cfg.shareToken = me.shareToken || null;
      cfg.energy = me.energy || null;
      cfg.pathStack = [];
      cfg.activeRootId = null;
      cfg.activeRootName = null;
      save(cfg);
      console.log(chalk.green(`✓ Logged in as ${me.username}`));
      if (me.profileType) console.log(chalk.dim(`  Plan: ${me.profileType}`));
      const data = await api.getUser(me.userId);
      const roots = data.roots || data.user?.roots || [];
      if (roots.length) {
        console.log(chalk.dim("\nYour trees:"));
        roots.forEach((r) =>
          console.log(`  ${chalk.cyan(r.name)}  ${chalk.dim(r._id)}`),
        );
        console.log(chalk.dim(`\nRun: use "<tree name>" to select one`));
      }
    } catch (e) {
      console.error(chalk.red("Login failed:"), e.message);
    }
  });

program
  .command("logout")
  .description("Clear stored credentials")
  .action(() => {
    const cfg = load();
    cfg.apiKey = null;
    cfg.userId = null;
    cfg.pathStack = [];
    cfg.activeRootId = null;
    save(cfg);
    console.log(chalk.green("Logged out."));
  });

// ─────────────────────────────────────────────────────────────────────────────
// ROOT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("roots")
  .description("List all your root trees")
  .action(async () => {
    const cfg = requireAuth();
    const api = new TreeAPI(cfg.apiKey);
    try {
      const data = await api.getUser(cfg.userId);
      const roots = data.roots || data.user?.roots || [];
      if (!roots.length)
        return console.log(chalk.dim("No trees yet. Run: tree mkroot <name>"));
      printTable(roots, [
        { key: "name", label: "Name", width: 24 },
        { key: "_id", label: "ID", width: 28 },
      ]);
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("use <nameOrId...>")
  .description("Switch active root tree by name or ID")
  .action(async (parts) => {
    const nameOrId = parts.join(" ");
    const cfg = requireAuth();
    const api = new TreeAPI(cfg.apiKey);
    try {
      const data = await api.getUser(cfg.userId);
      const roots = data.roots || data.user?.roots || [];
      const root = findChild(roots, nameOrId);
      if (!root) return;
      cfg.activeRootId = root._id;
      cfg.activeRootName = root.name;
      cfg.pathStack = [];
      save(cfg);
      console.log(chalk.green(`✓ Switched to "${root.name}"`));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("root <nameOrId...>")
  .description("Switch active root tree by name or ID (alias for use)")
  .action(async (parts) => {
    const nameOrId = parts.join(" ");
    const cfg = requireAuth();
    const api = new TreeAPI(cfg.apiKey);
    try {
      const data = await api.getUser(cfg.userId);
      const roots = data.roots || data.user?.roots || [];
      const root = findChild(roots, nameOrId);
      if (!root) return;
      cfg.activeRootId = root._id;
      cfg.activeRootName = root.name;
      cfg.pathStack = [];
      save(cfg);
      console.log(chalk.green(`✓ Switched to "${root.name}"`));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("mkroot <name...>")
  .description("Create a new root tree")
  .action(async (parts) => {
    const name = parts.join(" ");
    const cfg = requireAuth();
    const api = new TreeAPI(cfg.apiKey);
    try {
      const data = await api.createRoot(cfg.userId, name);
      console.log(
        chalk.green(`✓ Created tree "${name}"  `) +
          chalk.dim(data.root?._id || ""),
      );
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("home")
  .description("Leave the current tree and go back to user home")
  .action(() => {
    const cfg = requireAuth();
    cfg.activeRootId = null;
    cfg.activeRootName = null;
    cfg.pathStack = [];
    save(cfg);
    console.log(chalk.green("✓ Back at home (no tree selected)"));
  });

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION (cd, pwd, ls, tree)
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("pwd")
  .description("Print current path")
  .action(() => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(
        chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"),
      );
    console.log(chalk.cyan(currentPath(cfg)));
  });

program
  .command("ls")
  .description("List children of the node you are in")
  .option("-l", "Long format with IDs and status")
  .action(async ({ l }) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(
        chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"),
      );
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.getNode(nodeId);
      const children = getChildren(data);

      if (!children.length) return console.log(chalk.dim("  (empty)"));

      if (l) {
        printTable(children, [
          { key: "name", label: "Name", width: 28 },
          { key: "status", label: "Status", width: 12 },
          { key: "_id", label: "ID", width: 28 },
        ]);
      } else {
        const names = children.map((c) => {
          const color =
            c.status === "completed"
              ? chalk.gray
              : c.status === "trimmed"
                ? chalk.dim
                : chalk.cyan;
          return color(c.name);
        });
        console.log(names.join(chalk.dim("  ·  ")));
      }
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("cd <nameOrId...>")
  .description('Navigate into a child node by name or ID (use ".." to go up, -r to search whole tree)')
  .option("-r, --recursive", "Search entire tree, not just direct children")
  .action(async (parts, opts) => {
    const name = parts.join(" ");
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));

    if (name === "..") {
      if (cfg.pathStack.length === 0)
        return console.log(chalk.dim("Already at root."));
      cfg.pathStack.pop();
      save(cfg);
      return;
    }

    if (name === "/") {
      cfg.pathStack = [];
      save(cfg);
      return;
    }

    const api = new TreeAPI(cfg.apiKey);
    try {
      if (opts.recursive) {
        const rootData = await api.getRoot(cfg.activeRootId);
        const rootNode = rootData.root || rootData;
        const all = flattenTree(rootNode);
        const q = name.toLowerCase();

        const matches = all.filter(({ node }) =>
          node.name && (
            node._id === name ||
            node._id.startsWith(name) ||
            node.name.toLowerCase() === q ||
            node.name.toLowerCase().startsWith(q) ||
            node.name.toLowerCase().includes(q)
          )
        );

        if (!matches.length) {
          return console.log(chalk.yellow(`No node matching "${name}"`));
        }
        if (matches.length === 1) {
          cfg.pathStack = matches[0].pathStack.slice(1);
          save(cfg);
          return;
        }
        console.log(chalk.yellow(`Multiple matches for "${name}" — use a more specific name or cd <id> directly:`));
        matches.forEach(({ node, pathStack }) => {
          const fullPath = "/" + pathStack.map(n => n.name).join("/");
          console.log(`  ${chalk.cyan(fullPath)}  ${chalk.dim(node._id)}`);
        });
        return;
      }

      const nodeId = currentNodeId(cfg);
      const data = await api.getNode(nodeId);
      const children = getChildren(data);
      const target = findChild(children, name);

      if (!target) {
        // If it looks like an ID, search the full tree automatically
        // Otherwise hint the user to use -r
        const looksLikeId = /^[0-9a-f-]{8,}$/i.test(name);
        if (!looksLikeId) {
          console.log(chalk.dim(`  (tip: use "cd ${name} -r" to search the whole tree)`));
          return;
        }
        const rootData = await api.getRoot(cfg.activeRootId);
        const rootNode = rootData.root || rootData;
        const all = flattenTree(rootNode);
        const match = all.find(({ node }) => node._id === name || node._id.startsWith(name));
        if (!match) return console.log(chalk.yellow(`No node with ID "${name}"`));
        cfg.pathStack = match.pathStack.slice(1);
        save(cfg);
        return;
      }

      cfg.pathStack.push({ id: target._id, name: target.name });
      save(cfg);
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("tree")
  .description("Render the subtree from the node you are in")
  .action(async () => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.getRoot(nodeId);
      const node = data.root || data;
      printNode(node);
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("calendar")
  .description("Show scheduled dates across the tree")
  .option("-m, --month <month>", "Filter by month (0-11)")
  .option("-y, --year <year>", "Filter by year")
  .action(async ({ month, year }) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const opts = {};
      if (month != null) opts.month = month;
      if (year) opts.year = year;
      const data = await api.getCalendar(currentNodeId(cfg), opts);
      const events = data.calendar || data.events || data || [];
      if (!Array.isArray(events) || !events.length)
        return console.log(chalk.dim("  (no scheduled items)"));
      events.forEach((e, i) => {
        const date = e.schedule || e.date || e.scheduledDate || "";
        const ts = date ? chalk.yellow(new Date(date).toLocaleString()) : "";
        const name = e.name || e.nodeName || "";
        const id = e._id || e.nodeId || "";
        console.log(`  ${chalk.cyan(i + 1 + ".")} ${name}  ${ts}  ${chalk.dim(id)}`);
      });
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("dream-time <time...>")
  .description("Set nightly dream scheduling time (e.g. 9:30pm, 21:30, or 'clear')")
  .action(async (parts) => {
    const input = parts.join(" ").trim();
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      if (input === "clear") {
        await api.setDreamTime(cfg.activeRootId, null);
        return console.log(chalk.green("✓ Dream time cleared"));
      }
      // Parse time: accepts 9:30pm, 9:30 pm, 21:30, 09:30
      const m = input.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
      if (!m) return console.log(chalk.red(`Invalid time "${input}". Use formats like 9:30pm, 21:30, or clear`));
      let hour = parseInt(m[1], 10);
      const min = m[2];
      const ampm = m[3];
      if (ampm) {
        const ap = ampm.toLowerCase();
        if (ap === "pm" && hour < 12) hour += 12;
        if (ap === "am" && hour === 12) hour = 0;
      }
      if (hour > 23 || parseInt(min, 10) > 59)
        return console.log(chalk.red("Invalid time value"));
      const dreamTime = `${String(hour).padStart(2, "0")}:${min}`;
      await api.setDreamTime(cfg.activeRootId, dreamTime);
      const h12 = hour % 12 || 12;
      const label = hour >= 12 ? "PM" : "AM";
      console.log(chalk.green(`✓ Dream time set to ${h12}:${min} ${label}`));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// NODE MANAGEMENT (mkdir, rm, mv, rename, status)
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("mkdir <name...>")
  .description("Create child node(s). Comma-separate for multiple: mkdir foo, bar, baz")
  .action(async (parts) => {
    const raw = parts.join(" ");
    const names = raw.split(",").map(n => n.trim()).filter(Boolean);
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      for (const name of names) {
        const data = await api.createChild(nodeId, name);
        const id = data.node?._id || data._id || "";
        console.log(chalk.green(`✓ Created "${name}"`) + "  " + chalk.dim(id));
      }
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("rm <nameOrId>")
  .description("Delete a child node by name or ID")
  .option("-f, --force", "Skip confirmation")
  .action(async (name, { force }) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.getNode(nodeId);
      const children = getChildren(data);
      const target = findChild(children, name);
      if (!target) return;

      if (!force) {
        console.log(
          chalk.yellow(
            `Delete "${name}" (${target._id})? This is a soft delete. Pass -f to confirm.`,
          ),
        );
        return;
      }

      await api.deleteNode(target._id);
      console.log(chalk.green(`✓ Deleted "${name}"`));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("mv <nameOrId> <destNodeId>")
  .description("Move a child node to a new parent")
  .action(async (nodeName, destNodeId) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.getNode(nodeId);
      const children = getChildren(data);
      const target = findChild(children, nodeName);
      if (!target) return;

      await api.moveNode(target._id, destNodeId);
      console.log(chalk.green(`✓ Moved "${nodeName}" → ${destNodeId}`));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("rename <nameOrId> <newName>")
  .description("Rename a child node")
  .action(async (oldName, newName) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.getNode(nodeId);
      const children = getChildren(data);
      const target = findChild(children, oldName);
      if (!target) return;

      await api.renameNode(target._id, "latest", newName);
      console.log(chalk.green(`✓ Renamed "${oldName}" → "${newName}"`));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("status <nameOrId> <status>")
  .description("Set status on a child node (active|completed|trimmed)")
  .action(async (name, status) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    if (!["active", "completed", "trimmed"].includes(status))
      return console.error(
        chalk.red("Status must be: active | completed | trimmed"),
      );
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.getNode(nodeId);
      const children = getChildren(data);
      const target = findChild(children, name);
      if (!target) return;

      await api.setStatus(target._id, "latest", status);
      console.log(chalk.green(`✓ Set "${name}" → ${status}`));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("schedule <args...>")
  .description("Set schedule on the current node (e.g. 1/11/2025 3, 1/11/2025 11:45pm 5, or 'clear')")
  .action(async (args) => {
    const raw = args.join(" ");
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      if (raw === "clear") {
        await api.setSchedule(nodeId, "latest", null, 0);
        return console.log(chalk.green("✓ Schedule cleared"));
      }

      // Last arg is reeffectTime if it's a plain integer (no "/" or ":")
      let reeffect = 0;
      const last = args[args.length - 1];
      const dateParts = [...args];
      if (/^\d+$/.test(last) && args.length > 1) {
        reeffect = Number(dateParts.pop());
      }

      const schedule = parseDate(dateParts.join(" "));
      await api.setSchedule(nodeId, "latest", schedule, reeffect);
      console.log(
        chalk.green(`✓ Scheduled for ${new Date(schedule).toLocaleString()}`) +
          (reeffect ? chalk.dim(` (reeffect: ${reeffect}h)`) : ""),
      );
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("prestige")
  .description("Prestige the node you are in (create a new version)")
  .action(async () => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.prestige(nodeId);
      const ver = data.version ?? data.newVersion ?? "";
      console.log(chalk.green(`✓ Prestiged`) + (ver !== "" ? `  ${chalk.dim("version " + ver)}` : ""));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// NOTES (note, notes, cat, edit-note, rm-note)
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("note <content...>")
  .description("Post a note on the node you are in")
  .action(async (parts) => {
    const content = parts.join(" ");
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.createNote(nodeId, "latest", content);
      console.log(
        chalk.green("✓ Note saved") + "  " + chalk.dim(data._id || ""),
      );
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("notes")
  .description("List notes (user notes at home, node notes in a tree)")
  .action(async () => {
    const cfg = requireAuth();
    const api = new TreeAPI(cfg.apiKey);
    try {
      if (!cfg.activeRootId) {
        // Home mode — fetch user notes
        const data = await api.listUserNotes(cfg.userId);
        const notes = data.notes || data || [];
        printNotes(Array.isArray(notes) ? notes : []);
      } else {
        // Tree mode — fetch node notes
        const nodeId = currentNodeId(cfg);
        const data = await api.listNotes(nodeId, "latest");
        const notes = data.notes || data || [];
        printNotes(Array.isArray(notes) ? notes : []);
      }
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("rm-note <noteId>")
  .description("Delete a note by ID")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (noteId, { force }) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    if (!force)
      return console.log(
        chalk.yellow(`Delete note ${noteId}? Pass -f to confirm.`),
      );
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      await api.deleteNote(nodeId, "latest", noteId);
      console.log(chalk.green("✓ Note deleted"));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("book")
  .description("Print the full book of notes from the node you are in")
  .action(async () => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const data = await api.getBook(currentNodeId(cfg));
      const book = data.book || data || {};
      printBook(book);
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// CONTRIBUTIONS
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("contributions")
  .description("List contributions (user at home, node in a tree)")
  .action(async () => {
    const cfg = requireAuth();
    const api = new TreeAPI(cfg.apiKey);
    try {
      if (!cfg.activeRootId) {
        const data = await api.listUserContributions(cfg.userId, { limit: 50 });
        const items = data.contributions || data || [];
        printContributions(Array.isArray(items) ? items : []);
      } else {
        const nodeId = currentNodeId(cfg);
        const data = await api.listNodeContributions(nodeId, "latest", { limit: 50 });
        const items = data.contributions || data || [];
        printContributions(Array.isArray(items) ? items : []);
      }
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// VALUES
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("values")
  .description("List values on the node you are in")
  .action(async () => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.getValues(nodeId);
      const vals = data.values || data || {};
      const entries = Object.entries(vals).filter(
        ([k]) => !k.startsWith("_auto__"),
      );
      if (!entries.length) return console.log(chalk.dim("  (no values)"));
      entries.forEach(([k, v]) => console.log(`  ${chalk.cyan(k)}  ${v}`));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("value <key> <value>")
  .description("Set a value on the node you are in")
  .action(async (key, value) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const parsed = isNaN(value) ? value : Number(value);
      await api.setValue(nodeId, "latest", key, parsed);
      console.log(chalk.green(`✓ Set ${key} = ${parsed}`));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("goal <key> <goal>")
  .description("Set a goal on the node you are in")
  .action(async (key, goal) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const parsed = isNaN(goal) ? goal : Number(goal);
      await api.setGoal(nodeId, "latest", key, parsed);
      console.log(chalk.green(`✓ Goal ${key} = ${parsed}`));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// BLOG
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("blogs")
  .description("List creator blog posts — updates and news about Tree")
  .action(async () => {
    const api = new TreeAPI("");
    try {
      const data = await api.listBlogPosts();
      const posts = data.posts || [];
      if (!posts.length) return console.log(chalk.dim("  (no posts)"));
      posts.forEach((p, i) => {
        const date = p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : "";
        console.log(`  ${chalk.cyan(i + 1 + ".")} ${chalk.bold(p.title)}`);
        console.log(`      ${chalk.dim((p.authorName || "") + (date ? " · " + date : ""))}`);
        if (p.summary) console.log(`      ${chalk.dim(p.summary)}`);
        console.log();
      });
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("blog <slugOrNumber...>")
  .description("Read a blog post by slug or list number")
  .action(async (parts) => {
    const input = parts.join("-");
    const api = new TreeAPI("");
    try {
      let slug = input;
      // If numeric — resolve by index from list
      if (/^\d+$/.test(input)) {
        const data = await api.listBlogPosts();
        const posts = data.posts || [];
        const idx = parseInt(input, 10) - 1;
        if (!posts[idx]) return console.log(chalk.red(`No post at index ${input}`));
        slug = posts[idx].slug;
      }
      let postData;
      try {
        postData = await api.getBlogPost(slug);
      } catch (_) {
        // Slug not found — try fuzzy match
        const list = await api.listBlogPosts();
        const match = (list.posts || []).find(p =>
          p.title.toLowerCase().includes(input.toLowerCase()) ||
          p.slug.includes(input.toLowerCase())
        );
        if (!match) return console.log(chalk.red(`No post found for "${input}"`));
        postData = await api.getBlogPost(match.slug);
      }
      const post = postData.post;
      const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "";
      console.log(chalk.bold("\n" + post.title));
      console.log(chalk.dim((post.authorName || "") + (date ? " · " + date : "")) + "\n");
      if (post.summary) console.log(chalk.dim(post.summary) + "\n");
      if (post.content) {
        const text = post.content
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
          .trim();
        console.log(text);
      }
      console.log();
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

// Helper to print a clickable OSC 8 hyperlink in the terminal
function termLink(url, label) {
  return `\u001B]8;;${url}\u001B\\${label}\u001B]8;;\u001B\\`;
}

program
  .command("share-token [token]")
  .description("Show or set your share token. share-token <token> to update")
  .action(async (token) => {
    const cfg = requireAuth();
    if (!token) {
      return console.log(cfg.shareToken ? chalk.cyan(cfg.shareToken) : chalk.dim("(none)"));
    }
    const api = new TreeAPI(cfg.apiKey);
    try {
      await api.setShareToken(cfg.userId, token);
      cfg.shareToken = token;
      save(cfg);
      console.log(chalk.green("✓ Share token updated"));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("share [type] [id]")
  .description("Generate a public share link. share idea <id> | share note <id> | share book")
  .action(async (type, id) => {
    if (!type) {
      const cfg = load();
      if (cfg.activeRootId) return console.log(chalk.yellow("Usage: share note <id> | share book"));
      return console.log(chalk.yellow("Usage: share idea <id> | share note <id>"));
    }
    const cfg = requireAuth();
    const BASE = "https://tree.tabors.site";

    if (type === "idea") {
      if (!id) return console.log(chalk.yellow("Usage: share idea <rawIdeaId>"));
      const url = `${BASE}/api/v1/user/${cfg.userId}/raw-ideas/${id}?html`;
      return console.log(termLink(url, url));
    }

    if (type === "note") {
      if (!id) return console.log(chalk.yellow("Usage: share note <noteId>"));
      if (!cfg.activeRootId) return console.log(chalk.yellow("Enter a tree first."));
      const nodeId = currentNodeId(cfg);
      const url = `${BASE}/api/v1/node/${nodeId}/latest/notes/${id}?html`;
      return console.log(termLink(url, url));
    }

    if (type === "book") {
      if (!cfg.activeRootId) return console.log(chalk.yellow("Enter a tree first."));
      const nodeId = currentNodeId(cfg);
      const settings = { toc: true };
      const api = new TreeAPI(cfg.apiKey);
      try {
        const data = await api.generateBookShare(nodeId, settings);
        const path = data.redirect || data.shareUrl;
        if (!path) return console.log(chalk.red("No share link returned"));
        const url = `${BASE}${path.startsWith("/") ? path : "/" + path}`;
        console.log(termLink(url, url));
      } catch (e) {
        console.error(chalk.red(e.message));
      }
      return;
    }

    const cfg2 = load();
    if (cfg2.activeRootId) {
      console.log(chalk.yellow(`Unknown type "${type}". Use: share note <id> | share book`));
    } else {
      console.log(chalk.yellow(`Unknown type "${type}". Use: share idea <id> | share note <id> | share book`));
    }
  });

program
  .command("link [type] [id]")
  .description("Open a clickable link to your current location in the Tree web app")
  .action((type, id) => {
    const cfg = load();
    const BASE = "https://tree.tabors.site";
    const qs = cfg.shareToken ? `?token=${cfg.shareToken}&html` : "?html";

    if (!cfg.userId) {
      const url = `${BASE}/app`;
      return console.log(termLink(url, url));
    }

    let url;

    if (!type) {
      // No args — link to current context
      if (!cfg.activeRootId) {
        url = `${BASE}/api/v1/user/${cfg.userId}${qs}`;
      } else {
        const nodeId = currentNodeId(cfg);
        url = `${BASE}/api/v1/node/${nodeId}${qs}`;
      }
    } else if (type === "root") {
      if (!cfg.activeRootId) return console.log(chalk.yellow("Enter a tree first."));
      url = `${BASE}/api/v1/root/${cfg.activeRootId}${qs}`;
    } else if (type === "book") {
      const nodeId = cfg.activeRootId ? currentNodeId(cfg) : null;
      if (!nodeId) {
        return console.log(chalk.yellow("Enter a tree first to link the book."));
      }
      url = `${BASE}/api/v1/root/${cfg.activeRootId}/book${qs}`;
    } else if (type === "ideas") {
      url = `${BASE}/api/v1/user/${cfg.userId}/raw-ideas${qs}`;
    } else if (type === "idea") {
      if (!id) return console.log(chalk.yellow("Usage: link idea <rawIdeaId>"));
      url = `${BASE}/api/v1/user/${cfg.userId}/raw-ideas/${id}${qs}`;
    } else if (type === "note") {
      if (!id) return console.log(chalk.yellow("Usage: link note <noteId>"));
      const nodeId = currentNodeId(cfg);
      url = `${BASE}/api/v1/node/${nodeId}/latest/notes/${id}/editor${qs}`;
    } else {
      if (cfg.activeRootId) {
        return console.log(chalk.yellow(`Unknown link type "${type}". Try: link, link root, link book, link note <id>`));
      }
      return console.log(chalk.yellow(`Unknown link type "${type}". Try: link, link ideas, link idea <id>, link note <id>`));
    }

    console.log(termLink(url, url));
  });

// ─────────────────────────────────────────────────────────────────────────────
// CHATS
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("chats [scope]")
  .description("List AI chats. In home: your profile chats. In tree: node chats. 'chats tree' = all chats across the whole tree")
  .action(async (scope) => {
    const cfg = requireAuth();
    const api = new TreeAPI(cfg.apiKey);
    try {
      let data;
      if (!cfg.activeRootId) {
        // Home mode — user profile chats
        data = await api.listUserChats(cfg.userId);
      } else if (scope === "tree" || scope === "all") {
        // All chats across the whole tree
        data = await api.listRootChats(cfg.activeRootId);
      } else {
        // Current node chats
        const nodeId = currentNodeId(cfg);
        data = await api.listNodeChats(nodeId);
      }
      const sessions = data.chats || data.sessions || data || [];
      const list = Array.isArray(sessions) ? sessions.slice(0, 10) : [];
      printChats(list);
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// AI
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("chat <message...>")
  .description("Chat with AI about the branch you are in")
  .action(async (parts) => {
    const message = parts.join(" ");
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    console.log(chalk.dim("Thinking…"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.chat(nodeId, message);
      console.log(
        chalk.bold("\nTree:") + " " + (data.answer || JSON.stringify(data)),
      );
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("place <message...>")
  .description("AI-place a message into the branch you are in")
  .action(async (parts) => {
    const message = parts.join(" ");
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    console.log(chalk.dim("Placing…"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.place(nodeId, message);
      if (data.targetPath)
        console.log(chalk.green(`✓ Placed under: ${data.targetPath}`));
      else console.log(chalk.green("✓ Placed"));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("query <message...>")
  .description("Query AI about the branch you are in (read-only)")
  .action(async (parts) => {
    const message = parts.join(" ");
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    console.log(chalk.dim("Thinking…"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.query(nodeId, message);
      console.log(
        chalk.bold("\nTree:") + " " + (data.answer || JSON.stringify(data)),
      );
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// RAW IDEAS (available at user home / no tree required)
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("ideas")
  .description("List raw ideas (pending/stuck/processing by default). Stack flags to combine: --stuck --done")
  .option("--pending", "Show pending ideas")
  .option("--processing", "Show processing ideas")
  .option("--stuck", "Show stuck ideas")
  .option("--done", "Show succeeded ideas")
  .option("--all", "Show all ideas regardless of status")
  .option("-q, --query <query>", "Search raw ideas")
  .option("-l, --limit <n>", "Limit results")
  .action(async ({ pending, processing, stuck, done, all, query, limit }) => {
    const cfg = requireAuth();
    const api = new TreeAPI(cfg.apiKey);
    try {
      // Build the set of statuses to show
      const flaggedStatuses = [
        pending && "pending",
        processing && "processing",
        stuck && "stuck",
        done && "succeeded",
      ].filter(Boolean);

      const data = await api.listRawIdeas(cfg.userId, { status: "all", q: query, limit });
      let ideas = data.rawIdeas || data.ideas || data || [];

      if (flaggedStatuses.length) {
        ideas = ideas.filter(r => flaggedStatuses.includes(r.status));
      } else if (!all) {
        // Default view: pending, stuck, processing, failed
        ideas = ideas.filter(r => ["pending", "stuck", "processing", "failed"].includes(r.status));
      }

      if (!Array.isArray(ideas) || !ideas.length)
        return console.log(chalk.dim("  (no ideas)"));

      const statusColor = (s) => {
        if (s === "succeeded") return chalk.green(`[${s}]`);
        if (s === "processing") return chalk.blue(`[${s}]`);
        if (s === "stuck" || s === "failed") return chalk.red(`[${s}]`);
        return chalk.yellow(`[${s}]`);
      };

      ideas.forEach((idea, i) => {
        const ts = idea.createdAt ? chalk.dim(new Date(idea.createdAt).toLocaleString()) : "";
        const st = idea.status ? " " + statusColor(idea.status) : "";
        console.log(`  ${chalk.cyan(i + 1 + ".")} ${chalk.dim(idea._id)}${st}  ${ts}`);
        if (idea.content) console.log(`     ${idea.content.slice(0, 120)}`);
      });
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("idea-store <message...>")
  .description("Save a raw idea for later without processing")
  .action(async (parts) => {
    const content = parts.join(" ");
    const cfg = requireAuth();
    const api = new TreeAPI(cfg.apiKey);
    try {
      const data = await api.createRawIdea(cfg.userId, content);
      const id = data.rawIdea?._id || data._id || "";
      console.log(chalk.green("✓ Raw idea saved") + "  " + chalk.dim(id));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("rm-idea <rawIdeaId>")
  .description("Delete a raw idea")
  .option("-f, --force", "Skip confirmation")
  .action(async (rawIdeaId, { force }) => {
    const cfg = requireAuth();
    if (!force)
      return console.log(chalk.yellow(`Delete raw idea ${rawIdeaId}? Pass -f to confirm.`));
    const api = new TreeAPI(cfg.apiKey);
    try {
      await api.deleteRawIdea(cfg.userId, rawIdeaId);
      console.log(chalk.green("✓ Raw idea deleted"));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("idea-place <input...>")
  .description("AI-place an idea (fire-and-forget). Pass a rawIdeaId or just type your idea directly")
  .action(async (parts) => {
    const input = parts.join(" ");
    const cfg = requireAuth();
    console.log(chalk.dim("Placing…"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      // UUID pattern — treat as existing raw idea ID
      const isId = /^[0-9a-f-]{36}$/i.test(input);
      const data = isId
        ? await api.rawIdeaPlace(cfg.userId, input)
        : await api.rawIdeaPlaceContent(cfg.userId, input);
      console.log(chalk.green("✓ Placement started (background)"));
      if (data.rawIdeaId) console.log(chalk.dim(`  Raw idea: ${data.rawIdeaId}`));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("idea <message...>")
  .description("Send an idea from anywhere — AI places it in the right tree and navigates you there")
  .action(async (parts) => {
    const input = parts.join(" ");
    const cfg = requireAuth();
    console.log(chalk.dim("Thinking…"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      // UUID pattern — treat as existing raw idea ID
      const isId = /^[0-9a-f-]{36}$/i.test(input);
      const data = isId
        ? await api.rawIdeaChat(cfg.userId, input)
        : await api.rawIdeaChatContent(cfg.userId, input);
      if (!data.success) return console.log(chalk.red(data.error || "Failed"));
      console.log(chalk.bold("\nAnswer:\n") + (data.answer || ""));
      if (data.rootName) console.log(chalk.dim(`\nPlaced in tree: ${data.rootName}`));
      if (data.targetNodeId && data.rootId) {
        cfg.activeRootId = data.rootId;
        cfg.activeRootName = data.rootName || data.rootId;
        if (data.targetNodePath && data.targetNodePath.length) {
          cfg.pathStack = data.targetNodePath.map(n => ({ id: n._id, name: n.name }));
        } else if (data.targetNodeName) {
          cfg.pathStack = [{ id: data.targetNodeId, name: data.targetNodeName }];
        } else {
          // No name available — skip navigation to avoid showing raw UUID in path
          save(cfg);
          console.log(chalk.green(`✓ Placed in tree: ${data.rootName || data.rootId}`));
          return;
        }
        save(cfg);
        const pathStr = cfg.pathStack.map(n => n.name).join("/");
        console.log(chalk.green(`✓ Navigated to ${data.rootName || data.rootId} › ${pathStr}`));
      }
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("idea-transfer <rawIdeaId> <nodeId>")
  .description("Manually transfer a raw idea to a specific node")
  .action(async (rawIdeaId, nodeId) => {
    const cfg = requireAuth();
    const api = new TreeAPI(cfg.apiKey);
    try {
      await api.transferRawIdea(cfg.userId, rawIdeaId, nodeId);
      console.log(chalk.green(`✓ Transferred raw idea to node ${nodeId}`));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("idea-auto [toggle]")
  .description("Toggle auto-placement of pending raw ideas every 15 min (on/off). Requires Standard plan+")
  .action(async (toggle) => {
    const cfg = requireAuth();
    const api = new TreeAPI(cfg.apiKey);
    try {
      if (!toggle) {
        // No arg — fetch current user to show status
        const data = await api.getUser(cfg.userId);
        const enabled = data.user?.autoPlaceIdeas ?? data.autoPlaceIdeas;
        console.log(`Auto-placement: ${enabled ? chalk.green("on") : chalk.dim("off")}`);
        return;
      }
      const enabled = toggle === "on" || toggle === "true" || toggle === "1";
      const data = await api.rawIdeaAutoPlace(cfg.userId, enabled);
      console.log(`Auto-placement: ${data.enabled ? chalk.green("on") : chalk.dim("off")}`);
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// UNDERSTANDING RUNS (requires active tree)
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("understand [perspective...]")
  .description("Start an understanding run from the node you are in. Waits and returns the final encoding when complete")
  .option("-i, --incremental", "Only process new/changed nodes")
  .action(async (parts, { incremental }) => {
    const perspective = parts.length ? parts.join(" ") : "";
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      console.log(chalk.dim("Creating understanding run…"));
      const data = await api.createUnderstanding(
        nodeId,
        perspective || "",
        !!incremental,
      );
      const runId =
        data.understandingRunId || data.run?._id || data.runId || data._id || "";
      console.log(chalk.green("✓ Understanding run created") + "  " + chalk.dim(runId));
      if (data.perspective)
        console.log(chalk.dim(`  Perspective: ${data.perspective}`));
      if (data.nodeCount != null)
        console.log(chalk.dim(`  Nodes to process: ${data.nodeCount}`));

      // Auto-orchestrate the run
      if (runId) {
        console.log(chalk.dim("Orchestrating… (this may take a while)"));
        const orch = await api.orchestrateUnderstanding(nodeId, runId);
        console.log(chalk.green("✓ Orchestration complete"));
        if (orch.nodesProcessed != null)
          console.log(chalk.dim(`  Nodes processed: ${orch.nodesProcessed}`));
        if (orch.rootEncoding)
          console.log(chalk.bold("\nEncoding:\n") + orch.rootEncoding);
      }
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("understandings")
  .description("List understanding runs for the node you are in")
  .action(async () => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.listUnderstandings(nodeId);
      const runs = data.understandings || data.runs || data || [];
      if (!Array.isArray(runs) || !runs.length)
        return console.log(chalk.dim("  (no understanding runs)"));
      runs.forEach((run, i) => {
        const id = run._id || run.runId || "";
        const perspective = run.perspective ? chalk.white(run.perspective) : chalk.dim("(default)");
        const status = run.status ? chalk.yellow(` [${run.status}]`) : "";
        const ts = run.createdAt
          ? chalk.dim(new Date(run.createdAt).toLocaleString())
          : "";
        console.log(`  ${chalk.cyan(i + 1 + ".")} ${chalk.dim(id)}${status}  ${ts}`);
        console.log(`     Perspective: ${perspective}`);
        if (run.nodesProcessed != null && run.nodeCount != null)
          console.log(chalk.dim(`     Progress: ${run.nodesProcessed}/${run.nodeCount} nodes`));
      });
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("understand-status <runId>")
  .description("Check status of an understanding run")
  .action(async (runId) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const data = await api.getUnderstandingRun(currentNodeId(cfg), runId);
      const run = data.run || data;
      console.log(chalk.dim(`Run ID: ${run._id || runId}`));
      if (run.status) console.log(`Status: ${chalk.yellow(run.status)}`);
      if (run.perspective) console.log(`Perspective: ${run.perspective}`);
      if (run.nodesProcessed != null && run.nodeCount != null)
        console.log(`Progress: ${run.nodesProcessed}/${run.nodeCount} nodes`);
      if (run.rootEncoding)
        console.log(chalk.dim(`Encoding: ${run.rootEncoding.slice(0, 80)}…`));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("understand-stop <runId>")
  .description("Stop a running understanding run")
  .action(async (runId) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      await api.stopUnderstanding(currentNodeId(cfg), runId);
      console.log(chalk.green("✓ Understanding run stopped"));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// WHOAMI
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("whoami")
  .description("Show current login and active tree")
  .action(async () => {
    const cfg = load();
    if (!cfg.apiKey) return console.log(chalk.yellow("Not logged in."));
    // Re-sync from /me
    try {
      const api = new TreeAPI(cfg.apiKey);
      const me = await api.me();
      cfg.username = me.username;
      cfg.plan = me.profileType || null;
      cfg.planExpiresAt = me.planExpiresAt || null;
      cfg.shareToken = me.shareToken || null;
      cfg.energy = me.energy || null;
      save(cfg);
    } catch (_) {}
    console.log(`User:  ${chalk.cyan(cfg.username || cfg.userId)}`);
    if (cfg.plan) console.log(`Plan:  ${chalk.cyan(cfg.plan)}${cfg.planExpiresAt ? chalk.dim(" (expires " + new Date(cfg.planExpiresAt).toLocaleDateString() + ")") : ""}`);
    if (cfg.energy) console.log(`Energy: ${chalk.cyan(cfg.energy.available)} available  ${chalk.dim(cfg.energy.additional + " additional · " + cfg.energy.total + " total")}`);
    console.log(`Tree:  ${chalk.cyan(cfg.activeRootName || chalk.dim("(none)"))}  ${chalk.dim(cfg.activeRootId || "")}`);
    console.log(`Path:  ${chalk.cyan(currentPath(cfg))}`);
  });

// ─────────────────────────────────────────────────────────────────────────────
// SHELL (interactive REPL)
// ─────────────────────────────────────────────────────────────────────────────
const startShell = async () => {
    const readline = require("readline");
    const cfg = load();

    if (!cfg.apiKey) {
      console.log(
        chalk.yellow(
          "Not logged in. Run: treef login --key YOUR_KEY",
        ),
      );
      return;
    }

    // Prevent Commander from calling process.exit inside the shell
    program.exitOverride();
    program.configureOutput({
      writeErr: (str) => {
        // Suppress Commander's own error output — we handle it
        const clean = str.replace(/\x1b\[[0-9;]*m/g, "").trim();
        if (clean) console.error(chalk.red(clean));
      },
      writeOut: (str) => process.stdout.write(str),
    });

    console.log(
      chalk.bold.green("TreeF Shell") +
        chalk.dim('  (type "exit" to quit, "help" for commands)'),
    );
    console.log("");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    const prompt = () => {
      const cfg = load(); // re-read so prompt reflects cd/use changes
      const user = cfg.username || cfg.userId || "?";
      const p = chalk.green(user) + chalk.dim("@") + chalk.dim(currentPath(cfg)) + chalk.bold.cyan(" › ");
      rl.setPrompt(p);
      rl.prompt();
    };

    rl.on("line", async (line) => {
      const input = line.trim();
      if (!input) return prompt();
      if (input === "exit" || input === "quit") {
        rl.close();
        return;
      }

      // Reset all subcommand options so flags don't stick between invocations
      program.commands.forEach((cmd) => {
        cmd.options.forEach((opt) => {
          cmd.setOptionValueWithSource(opt.attributeName(), opt.defaultValue, "default");
        });
      });

      // Re-dispatch through Commander as if the user typed "tree <input>"
      try {
        await program.parseAsync(["node", "tree", ...shellSplit(input)]);
      } catch (e) {
        // exitOverride throws instead of exiting — just swallow
        if (!e.code?.startsWith("commander.")) {
          console.error(chalk.red(e.message));
        }
      }

      prompt();
    });

    rl.on("close", () => {
      console.log(chalk.dim("\nBye!"));
      process.exit(0);
    });

    rl.on("SIGINT", () => {
      if (rl.line.length > 0) {
        // Line has content — clear it and re-prompt
        rl.write(null, { ctrl: true, name: "u" });
        process.stdout.write("\n");
        prompt();
      } else {
        // Empty line — exit
        rl.close();
      }
    });

    prompt();
};

program
  .command("shell")
  .description("Start an interactive shell session")
  .action(startShell);

program
  .command("start")
  .description("Start an interactive shell session")
  .action(startShell);

program
  .command("stop")
  .description("Exit the shell (alias for typing exit)")
  .action(() => {
    console.log(chalk.dim("Bye!"));
    process.exit(0);
  });

// Split a shell-like line respecting quoted strings
// e.g. 'note "hello world"' → ['note', 'hello world']
function shellSplit(input) {
  const args = [];
  let current = "";
  let inQuote = null;
  for (const ch of input) {
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else current += ch;
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === " ") {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse — skip auto-parse when running interactively inside shell
// ─────────────────────────────────────────────────────────────────────────────
if (process.argv[2] !== "_shell_internal") {
  program.parseAsync(process.argv);
}
