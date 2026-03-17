#!/usr/bin/env node

const { Command } = require("commander");
const chalk = require("chalk");
const TreeAPI = require("./src/api");
const {
  load,
  save,
  requireAuth,
  currentNodeId,
  currentPath,
} = require("./src/config");
const { printNode, printTable, printNotes } = require("./src/display");

const program = new Command();

program
  .name("tree")
  .description(
    "CLI for Tree — navigate and manage your nodes like a filesystem",
  )
  .version("1.0.0");

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("login")
  .description("Authenticate with your API key")
  .requiredOption("--key <apiKey>", "Your Tree API key")
  .requiredOption("--user <userId>", "Your Tree user ID")
  .action(async ({ key, user }) => {
    try {
      const api = new TreeAPI(key);
      const data = await api.getUser(user);
      const username = data.user?.username || data.username || user;
      const cfg = load();
      cfg.apiKey = key;
      cfg.userId = user;
      cfg.username = username;
      cfg.pathStack = [];
      cfg.activeRootId = null;
      cfg.activeRootName = null;
      save(cfg);
      console.log(chalk.green(`✓ Logged in as ${username}`));
      // List roots so they can immediately `tree use`
      const roots = data.roots || data.user?.roots || [];
      if (roots.length) {
        console.log(chalk.dim("\nYour trees:"));
        roots.forEach((r) =>
          console.log(`  ${chalk.cyan(r.name)}  ${chalk.dim(r._id)}`),
        );
        console.log(chalk.dim(`\nRun: tree use "<tree name>" to select one`));
      }
    } catch (e) {
      console.error(chalk.red("Login failed:"), e.message);
      process.exit(1);
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
  .command("use <name>")
  .description("Switch active root tree by name")
  .action(async (name) => {
    const cfg = requireAuth();
    const api = new TreeAPI(cfg.apiKey);
    try {
      const data = await api.getUser(cfg.userId);
      const roots = data.roots || data.user?.roots || [];
      const root = roots.find(
        (r) => r.name.toLowerCase() === name.toLowerCase(),
      );
      if (!root) {
        console.error(chalk.red(`Tree "${name}" not found.`));
        const names = roots.map((r) => `  ${chalk.cyan(r.name)}`).join("\n");
        console.log("Available:\n" + names);
        return;
      }
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
  .command("mkroot <name>")
  .description("Create a new root tree")
  .action(async (name) => {
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
        chalk.yellow("No tree selected. Run: tree use <name>"),
      );
    console.log(chalk.cyan(currentPath(cfg)));
  });

program
  .command("ls")
  .description("List children of current node")
  .option("-l", "Long format with IDs and status")
  .action(async ({ l }) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(
        chalk.yellow("No tree selected. Run: tree use <name>"),
      );
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.getNode(nodeId);
      const versions = data.versions || data.node?.versions || [];
      const latest = versions[versions.length - 1] || {};
      const children = latest.children || data.children || [];

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
  .command("cd <name>")
  .description('Navigate into a child node (use ".." to go up)')
  .action(async (name) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected."));

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
      const versions = data.versions || data.node?.versions || [];
      const latest = versions[versions.length - 1] || {};
      const children = latest.children || data.children || [];

      const target = children.find(
        (c) => c.name.toLowerCase() === name.toLowerCase(),
      );
      if (!target) {
        console.error(chalk.red(`No child named "${name}"`));
        const names = children.map((c) => `  ${chalk.cyan(c.name)}`).join("\n");
        if (names) console.log("Children:\n" + names);
        return;
      }

      cfg.pathStack.push({ id: target._id, name: target.name });
      save(cfg);
      console.log(chalk.dim(currentPath(cfg)));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("tree")
  .description("Render the full tree from root")
  .action(async () => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected."));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const data = await api.getRoot(cfg.activeRootId);
      const root = data.root || data;
      printNode(root);
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// NODE MANAGEMENT (mkdir, rm, mv, rename, status)
// ─────────────────────────────────────────────────────────────────────────────
program
  .command("mkdir <name>")
  .description("Create a child node at current location")
  .action(async (name) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected."));
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
  .command("rm <name>")
  .description("Delete a child node by name")
  .option("-f, --force", "Skip confirmation")
  .action(async (name, { force }) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected."));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.getNode(nodeId);
      const versions = data.versions || data.node?.versions || [];
      const latest = versions[versions.length - 1] || {};
      const children = latest.children || data.children || [];
      const target = children.find(
        (c) => c.name.toLowerCase() === name.toLowerCase(),
      );
      if (!target) return console.error(chalk.red(`No child named "${name}"`));

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
  .command("mv <nodeName> <destNodeId>")
  .description("Move a child node to a new parent (by dest node ID)")
  .action(async (nodeName, destNodeId) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected."));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.getNode(nodeId);
      const versions = data.versions || data.node?.versions || [];
      const latest = versions[versions.length - 1] || {};
      const children = latest.children || data.children || [];
      const target = children.find(
        (c) => c.name.toLowerCase() === nodeName.toLowerCase(),
      );
      if (!target)
        return console.error(chalk.red(`No child named "${nodeName}"`));

      await api.moveNode(target._id, destNodeId);
      console.log(chalk.green(`✓ Moved "${nodeName}" → ${destNodeId}`));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("rename <oldName> <newName>")
  .description("Rename a child node")
  .action(async (oldName, newName) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected."));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.getNode(nodeId);
      const versions = data.versions || data.node?.versions || [];
      const latest = versions[versions.length - 1] || {};
      const children = latest.children || data.children || [];
      const target = children.find(
        (c) => c.name.toLowerCase() === oldName.toLowerCase(),
      );
      if (!target)
        return console.error(chalk.red(`No child named "${oldName}"`));

      await api.renameNode(target._id, 0, newName);
      console.log(chalk.green(`✓ Renamed "${oldName}" → "${newName}"`));
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("status <name> <status>")
  .description("Set status on a child node (active|completed|trimmed)")
  .action(async (name, status) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected."));
    if (!["active", "completed", "trimmed"].includes(status))
      return console.error(
        chalk.red("Status must be: active | completed | trimmed"),
      );
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.getNode(nodeId);
      const versions = data.versions || data.node?.versions || [];
      const latest = versions[versions.length - 1] || {};
      const children = latest.children || data.children || [];
      const target = children.find(
        (c) => c.name.toLowerCase() === name.toLowerCase(),
      );
      if (!target) return console.error(chalk.red(`No child named "${name}"`));

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
  .command("note <content>")
  .description("Post a note on the current node")
  .action(async (content) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected."));
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
  .description("List all notes on the current node")
  .action(async () => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected."));
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
  .command("cat <noteId>")
  .description("View a note by ID")
  .action(async (noteId) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected."));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const nodeId = currentNodeId(cfg);
      const data = await api.getNote(nodeId, 0, noteId);
      const note = data.note || data;
      console.log(chalk.dim(`ID: ${note._id}`));
      console.log(
        chalk.dim(`Date: ${new Date(note.createdAt).toLocaleString()}`),
      );
      console.log("");
      console.log(note.content || chalk.dim("(no text content)"));
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
      return console.log(chalk.yellow("No tree selected."));
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
  .description("List values on the current node")
  .action(async () => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected."));
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
  .description("Set a value on the current node")
  .action(async (key, value) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected."));
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
  .command("chat <message>")
  .description("Send a message to the AI for the current tree")
  .action(async (message) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected."));
    console.log(chalk.dim("Thinking…"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const data = await api.chat(cfg.activeRootId, message);
      console.log(
        chalk.bold("\nTree:") + " " + (data.answer || JSON.stringify(data)),
      );
    } catch (e) {
      console.error(chalk.red(e.message));
    }
  });

program
  .command("place <message>")
  .description("AI-place a message onto the current tree (no response, faster)")
  .action(async (message) => {
    const cfg = requireAuth();
    if (!cfg.activeRootId)
      return console.log(chalk.yellow("No tree selected."));
    console.log(chalk.dim("Placing…"));
    const api = new TreeAPI(cfg.apiKey);
    try {
      const data = await api.place(cfg.activeRootId, message);
      if (data.targetPath)
        console.log(chalk.green(`✓ Placed under: ${data.targetPath}`));
      else console.log(chalk.green("✓ Placed"));
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
program
  .command("shell")
  .description("Start an interactive shell session")
  .action(async () => {
    const readline = require("readline");
    const cfg = load();

    if (!cfg.apiKey) {
      console.log(
        chalk.yellow(
          "Not logged in. Run: tree login --key YOUR_KEY --user YOUR_USER_ID",
        ),
      );
      process.exit(1);
    }

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
      const p = chalk.dim(currentPath(cfg)) + chalk.bold.cyan(" › ");
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
        // Commander calls process.exit on --help or unknown commands; swallow
        if (e.code !== "commander.unknownCommand" && e.exitCode !== 0) {
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
