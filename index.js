#!/usr/bin/env node

const { Command } = require("commander");
const chalk = require("chalk");
const TreeAPI = require("./api");
const {
  load,
  save,
  requireAuth,
  currentNodeId,
  currentPath,
} = require("./config");
const { printNode, printTable, printNotes } = require("./display");

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
      chalk.yellow(`Multiple children named "${query}". Use an ID to disambiguate:`),
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
      chalk.yellow(`Multiple matches for "${query}":`),
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
      chalk.yellow(`Multiple matches for "${query}":`),
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
  .name("tree")
  .description(
    "CLI for Tree — navigate and manage your nodes like a filesystem",
  )
  .version("1.0.0")
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
          cmds: ["roots", "use", "mkroot", "home", "ideas", "idea", "rm-idea", "idea-place", "idea-transfer"],
        },
        {
          title: "Navigation (inside a tree)",
          cmds: ["pwd", "ls", "cd", "tree"],
        },
        {
          title: "Node Management",
          cmds: ["mkdir", "rm", "mv", "rename", "status"],
        },
        {
          title: "Notes & Values",
          cmds: ["note", "notes", "rm-note", "values", "set"],
        },
        {
          title: "AI",
          cmds: ["chat", "place"],
        },
        {
          title: "Understanding Runs",
          cmds: ["understand", "understandings", "understand-status", "understand-stop"],
        },
      ];

      const cmdMap = {};
      cmd.commands.forEach((c) => {
        cmdMap[c.name()] = c;
      });

      let out = `Usage: ${helper.commandUsage(cmd)}\n\n`;
      out += `${cmd.description()}\n`;
      out += `https://tree.tabors.site\n\n`;

      const pad = 40;
      const fmtUsage = (c) => {
        // Strip [options] from usage for cleaner output
        return (c.name() + " " + c.usage()).replace(/ \[options\]/g, "").trim();
      };

      for (const section of sections) {
        out += `${section.title}:\n`;
        for (const name of section.cmds) {
          const c = cmdMap[name];
          if (!c) continue;
          const usage = fmtUsage(c);
          out += `  ${usage.padEnd(pad)}${c.description()}\n`;
          delete cmdMap[name];
        }
        out += "\n";
      }

      // Any remaining commands not in a section
      const remaining = Object.values(cmdMap);
      if (remaining.length) {
        out += "Other:\n";
        for (const c of remaining) {
          const usage = fmtUsage(c);
          out += `  ${usage.padEnd(pad)}${c.description()}\n`;
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
      const userId = me.userId;
      const data = await api.getUser(userId);
      const username = me.username || data.user?.username || data.username || userId;
      const cfg = load();
      cfg.apiKey = key;
      cfg.userId = userId;
      cfg.username = username;
      cfg.pathStack = [];
      cfg.activeRootId = null;
      cfg.activeRootName = null;
      save(cfg);
      console.log(chalk.green(`✓ Logged in as ${username}`));
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
        console.log(names.join("  "));
      }
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("cd <nameOrId...>")
  .description('Navigate into a child node by name or ID (use ".." to go up)')
  .action(async (parts) => {
    const name = parts.join(" ");
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));

    if (name === "..") {
      if (cfg.pathStack.length === 0)
        return console.log(chalk.dim("Already at root."));
      cfg.pathStack.pop();
      save(cfg);
      return console.log(chalk.dim(currentPath(cfg)));
    }

    if (name === "/") {
      cfg.pathStack = [];
      save(cfg);
      return console.log(chalk.dim(currentPath(cfg)));
    }

    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.getNode(nodeId);
      const children = getChildren(data);

      const target = findChild(children, name);
      if (!target) return;

      cfg.pathStack.push({ id: target._id, name: target.name });
      save(cfg);
      console.log(chalk.dim(currentPath(cfg)));
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

// ─────────────────────────────────────────────────────────────────────────────
// NODE MANAGEMENT (mkdir, rm, mv, rename, status)
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("mkdir <name...>")
  .description("Create a child under the node you are in")
  .action(async (parts) => {
    const name = parts.join(" ");
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.createChild(nodeId, name);
      const id = data.node?._id || data._id || "";
      console.log(chalk.green(`✓ Created "${name}"`) + "  " + chalk.dim(id));
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

      await api.renameNode(target._id, 0, newName);
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

      await api.setStatus(target._id, 0, status);
      console.log(chalk.green(`✓ Set "${name}" → ${status}`));
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
      const data = await api.createNote(nodeId, 0, content);
      console.log(
        chalk.green("✓ Note saved") + "  " + chalk.dim(data._id || ""),
      );
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("notes")
  .description("List notes on the node you are in")
  .action(async () => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.listNotes(nodeId, 0);
      const notes = data.notes || data || [];
      printNotes(Array.isArray(notes) ? notes : []);
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
      await api.deleteNote(nodeId, 0, noteId);
      console.log(chalk.green("✓ Note deleted"));
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
  .command("set <key> <value>")
  .description("Set a value on the node you are in")
  .action(async (key, value) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected. Run: use <name>, roots, or mkroot <name>"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const parsed = isNaN(value) ? value : Number(value);
      await api.setValue(nodeId, 0, key, parsed);
      console.log(chalk.green(`✓ Set ${key} = ${parsed}`));
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
  .description("AI-place content into the branch you are in")
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

// ─────────────────────────────────────────────────────────────────────────────
// RAW IDEAS (available at user home / no tree required)
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("ideas")
  .description("List your raw ideas")
  .option("-s, --status <status>", "Filter by status")
  .option("-q, --query <query>", "Search raw ideas")
  .option("-l, --limit <n>", "Limit results")
  .action(async ({ status, query, limit }) => {
    const cfg = requireAuth();
    const api = new TreeAPI(cfg.apiKey);
    try {
      const data = await api.listRawIdeas(cfg.userId, { status, q: query, limit });
      const ideas = data.rawIdeas || data.ideas || data || [];
      if (!Array.isArray(ideas) || !ideas.length)
        return console.log(chalk.dim("  (no raw ideas)"));
      ideas.forEach((idea, i) => {
        const ts = idea.createdAt
          ? chalk.dim(new Date(idea.createdAt).toLocaleString())
          : "";
        const st = idea.status ? chalk.yellow(` [${idea.status}]`) : "";
        console.log(`  ${chalk.cyan(i + 1 + ".")} ${chalk.dim(idea._id)}${st}  ${ts}`);
        if (idea.content) console.log(`     ${idea.content.slice(0, 120)}`);
      });
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("idea <content...>")
  .description("Create a new raw idea")
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
  .command("idea-place <rawIdeaId>")
  .description("AI-place a raw idea into the best tree and node")
  .action(async (rawIdeaId) => {
    const cfg = requireAuth();
    console.log(chalk.dim("Placing…"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const data = await api.rawIdeaPlace(cfg.userId, rawIdeaId);
      console.log(chalk.green("✓ Orchestration started"));
      if (data.message) console.log(chalk.dim(`  ${data.message}`));
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

// ─────────────────────────────────────────────────────────────────────────────
// UNDERSTANDING RUNS (requires active tree)
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("understand [perspective...]")
  .description("Start an understanding run from the node you are in")
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
        console.log(chalk.dim("Orchestrating…"));
        const orch = await api.orchestrateUnderstanding(nodeId, runId);
        console.log(chalk.green("✓ Orchestration started"));
        if (orch.nodesProcessed != null)
          console.log(chalk.dim(`  Nodes processed: ${orch.nodesProcessed}`));
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
  .action(() => {
    const cfg = load();
    if (!cfg.apiKey) return console.log(chalk.yellow("Not logged in."));
    console.log(`User:  ${chalk.cyan(cfg.username || cfg.userId)}`);
    console.log(
      `Tree:  ${chalk.cyan(cfg.activeRootName || chalk.dim("(none)"))}  ${chalk.dim(cfg.activeRootId || "")}`,
    );
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
      chalk.bold.green("Tree Shell") +
        chalk.dim('  (type "exit" or Ctrl+C to quit, "help" for commands)'),
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
