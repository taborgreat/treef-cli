const chalk = require("chalk");
const TreeAPI = require("../api");
const { requireAuth, currentNodeId } = require("../config");
const { printNotes, printContributions, printBook } = require("../display");

module.exports = (program) => {
  program
    .command("note [content...]")
    .description("Post a note on the node you are in")
    .action(async (parts) => {
      if (!parts || !parts.length) return console.log(chalk.yellow("Usage: note <content>"));
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
          const data = await api.listUserNotes(cfg.userId);
          const notes = data.notes || data || [];
          printNotes(Array.isArray(notes) ? notes : []);
        } else {
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
    .command("tags")
    .alias("mail")
    .description("List notes where you've been @tagged by other users")
    .action(async () => {
      const cfg = requireAuth();
      const api = new TreeAPI(cfg.apiKey);
      try {
        const data = await api.listUserTags(cfg.userId);
        const tags = data.notes || data || [];
        if (!Array.isArray(tags) || !tags.length)
          return console.log(chalk.dim("  (no tags)"));
        printNotes(tags);
      } catch (e) {
        console.error(chalk.red(e.message));
      }
    });

  program
    .command("rm-note [noteId]")
    .description("Delete a note by ID")
    .option("-f, --force", "Skip confirmation prompt")
    .action(async (noteId, { force }) => {
      if (!noteId) return console.log(chalk.yellow("Usage: rm-note <noteId> -f"));
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
    .command("value [key] [value]")
    .description("Set a value on the node you are in")
    .action(async (key, value) => {
      if (!key || !value) return console.log(chalk.yellow("Usage: value <key> <value>"));
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
    .command("goal [key] [goal]")
    .description("Set a goal on the node you are in")
    .action(async (key, goal) => {
      if (!key || !goal) return console.log(chalk.yellow("Usage: goal <key> <goal>"));
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
};
