# treef-cli

CLI for [Tree](https://tree.tabors.site) — navigate and manage your trees like a filesystem from the terminal.

## Install

```bash
npm install -g treef-cli
```

## Get Started

```bash
treef login --key YOUR_API_KEY    # get your key from tree.tabors.site
treef start                       # launch the interactive shell
```

```
roots                        # list your trees
root Life Plan               # enter a tree
ls                           # list children
mkdir Health, Work, Projects # create nodes
cd Health                    # navigate deeper

chat make me a weekly workout plan
tree                         # see the structure it built
cd Workouts                  # go into a node it created
place did 20 pushups today   # AI logs it in the right spot
note stretch before next session

cd /                         # back to tree root
cd Health/Workouts -r        # path chaining + deep search
values --global              # see values across the whole tree

idea i should track my sleep # AI places it in the right tree
home                         # back to user home
exit                         # leave the shell
```

---

## Commands

### Session

| Command             | Description                               |
| ------------------- | ----------------------------------------- |
| `start` / `shell`   | Launch interactive shell                  |
| `stop` / `exit`     | Exit the shell                            |
| `login --key <key>` | Authenticate with your API key            |
| `logout`            | Clear stored credentials                  |
| `whoami`            | Show login, plan, energy, and active tree |

### User Home

Commands available without entering a tree. `ls` and `cd` also work from home to list/enter trees.

| Command                      | Description                                 |
| ---------------------------- | ------------------------------------------- |
| `roots`                      | List all your trees                         |
| `use <name>` / `root <name>` | Enter a tree by name or ID                  |
| `mkroot <name>`              | Create a new tree                           |
| `retire/leave [name] -f`     | Leave a shared tree or delete if sole owner |
| `home`                       | Leave current tree, return home             |
| `invites`                    | List pending invites from other users       |
| `tags` / `mail`              | Notes where you've been @tagged             |
| `notes`                      | Your user-level notes                       |
| `chats`                      | All AI chats across your trees              |
| `contributions`              | Your recent contributions                   |
| `share-token [token]`        | Show or set your share token                |
| `share idea <id>`            | Public link to a raw idea                   |

### Raw Ideas

Capture ideas from anywhere. AI figures out where they belong.

| Command                       | Description                                                           |
| ----------------------------- | --------------------------------------------------------------------- |
| `ideas`                       | List ideas. Flags: `--pending` `--stuck` `--done` `--all` (stackable) |
| `idea <message>`              | AI places your idea in the right tree and navigates you there         |
| `idea-store <message>`        | Save an idea for later without processing                             |
| `idea-place <id or message>`  | AI-place an idea (fire-and-forget)                                    |
| `idea-auto [on/off]`          | Toggle auto-placement every 15 min (Standard plan+)                   |
| `idea-transfer <id> <nodeId>` | Manually move an idea to a specific node                              |
| `rm-idea <id> -f`             | Delete a raw idea                                                     |

---

### Navigation

Inside a tree. `ls` and `cd` also work from home (listing/entering trees).

| Command        | Description                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------- |
| `pwd`          | Print current path                                                                           |
| `ls` / `ls -l` | List children. Long format shows IDs and status                                              |
| `cd <name>`    | Navigate into a child. Supports `..`, `/`, `-r` (search whole tree), path chaining (`A/B/C`) |
| `tree`         | Render subtree. Flags: `--active`, `--completed`, `--trimmed`                                |

Nodes have three statuses: **active** (green), **completed** (gray), **trimmed** (dim).

### Node Management

| Command               | Description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| `mkdir <name>`        | Create child node(s). Comma-separate for multiple: `mkdir foo, bar` |
| `rm <name> -f`        | Delete a node (soft delete)                                         |
| `rename <name> <new>` | Rename a child node                                                 |
| `mv <name> <destId>`  | Move a node to a new parent                                         |
| `complete`            | Set current node and all children to completed                      |
| `activate`            | Set current node and all children to active                         |
| `trim`                | Set current node and all children to trimmed                        |
| `prestige`            | Create a new version of the current node                            |

### Notes & Values

| Command             | Description                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| `note <content>`    | Post a note on the current node                                            |
| `notes`             | List notes on the current node                                             |
| `rm-note <id> -f`   | Delete a note                                                              |
| `book`              | Print the full book of notes from current node down                        |
| `contributions`     | List contributions on the current node                                     |
| `values`            | List values on the current node. `--global` for flat totals, `--tree` for per-node breakdown |
| `value <key> <val>` | Set a value                                                                |
| `goal <key> <goal>` | Set a goal                                                                 |

### Scheduling

Date: `MM/DD/YYYY`. Time: `HH:MM` or `HH:MMam/pm`. Reeffect: hours. Use `clear` to remove.

| Command                             | Description                                                       |
| ----------------------------------- | ----------------------------------------------------------------- |
| `schedule <date> [time] [reeffect]` | Set schedule (e.g. `1/11/2025 3`, `1/11/2025 11:45pm 5`, `clear`) |
| `calendar`                          | Show scheduled dates across the tree                              |
| `dream-time <HH:MM>`                | Set nightly dream time (or `clear`)                               |

### Collaboration

| Command              | Description                       |
| -------------------- | --------------------------------- |
| `team`               | Show owner and contributors       |
| `invite <username>`  | Invite a user to the current tree |
| `invite accept <id>` | Accept a pending invite           |
| `invite deny <id>`   | Decline a pending invite          |
| `kick <username>`    | Remove a contributor              |
| `owner <username>`   | Transfer tree ownership           |

### Links & Sharing

Clickable terminal hyperlinks. `link` uses your share token; `share` generates public links.

**In a tree:**

| Command           | Description                           |
| ----------------- | ------------------------------------- |
| `link`            | Link to current node                  |
| `link root`       | Link to tree root                     |
| `link book`       | Link to book view                     |
| `link gateway`    | Link to gateway channels              |
| `link note <id>`  | Link to a specific note               |
| `share note <id>` | Public link to a note                 |
| `share book`      | Public book share link (TOC included) |

**From home:**

| Command          | Description                 |
| ---------------- | --------------------------- |
| `link`           | Link to your profile        |
| `link ideas`     | Link to your raw ideas      |
| `link idea <id>` | Link to a specific raw idea |

### AI

| Command           | Description                                    |
| ----------------- | ---------------------------------------------- |
| `chat <message>`  | Chat with AI about the current branch          |
| `place <message>` | AI writes content into the branch              |
| `query <message>` | Ask AI about the branch (read-only, no writes) |
| `chats`           | Chat history for current node                  |
| `chats tree`      | All chat history across the whole tree         |

### Understanding Runs

| Command                     | Description                                        |
| --------------------------- | -------------------------------------------------- |
| `understand [perspective]`  | Start an understanding run. Returns final encoding |
| `understandings`            | List runs                                          |
| `understand-status <runId>` | Check progress                                     |
| `understand-stop <runId>`   | Stop a run                                         |

### Blog

No login required.

| Command                 | Description                        |
| ----------------------- | ---------------------------------- |
| `blogs`                 | List published posts               |
| `blog <slug or number>` | Read a post by slug or list number |

---

## Name Matching

All commands accept names or IDs. No quotes needed for multi-word names. Matching order:

1. Exact ID or ID prefix
2. Exact name (case-insensitive)
3. Name starts with query
4. Name contains query

Multiple matches prompt you to disambiguate by ID.

## How It Works

All commands map to the [Tree REST API](https://tree.tabors.site/about/api). Config stored in `~/.treef-cli/config.json`.

## Links

- [Tree](https://tree.tabors.site)
- [Getting Started](https://tree.tabors.site/about/gettingstarted)
- [Raw Ideas](https://tree.tabors.site/about/raw-ideas)
- [Energy System](https://tree.tabors.site/about/energy)
- [Dreams](https://tree.tabors.site/about/dreams)
- [Gateway](https://tree.tabors.site/about/gateway)
- [API Reference](https://tree.tabors.site/about/api)
- [CLI Guide](https://tree.tabors.site/about/cli)
- [Blog](https://tree.tabors.site/blog)
