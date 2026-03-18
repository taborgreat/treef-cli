# treef-cli

A command-line interface for [Tree](https://tree.tabors.site) — navigate and manage your trees like a filesystem.

> **https://tree.tabors.site**

---

## Install

```bash
npm install -g treef-cli
```

## Authentication

Get your API key from your [Tree profile page](https://tree.tabors.site), then:

```bash
treef login --key YOUR_API_KEY
```

## Quick Start

```bash
treef start                # launch the interactive shell
treef roots                # list your trees
treef use Life Plan        # switch into a tree
treef ls                   # list children
treef cd Health            # navigate deeper
treef tree                 # render the subtree
```

---

## Commands

### Session

| Command | Description |
| --- | --- |
| `start` / `shell` | Launch interactive shell |
| `stop` / `exit` | Exit the shell |
| `login --key <key>` | Authenticate with your API key |
| `logout` | Clear stored credentials |
| `whoami` | Show current login and active tree |

---

### User Home

Commands available without entering a tree.

| Command | Description |
| --- | --- |
| `roots` | List all your root trees |
| `use <name>` | Switch active root tree |
| `mkroot <name>` | Create a new root tree |
| `home` | Leave current tree, return to user home |
| `ideas` | List your raw ideas |
| `idea <content>` | Create a new raw idea |
| `rm-idea <id> -f` | Delete a raw idea |
| `idea-place <id>` | AI-place a raw idea into the best tree |
| `idea-transfer <id> <nodeId>` | Transfer a raw idea to a specific node |
| `notes` | List your user-level notes |
| `chats` | List recent AI chat sessions |
| `contributions` | List your recent contributions |

---

### Tree Navigation

Commands available once you are inside a tree.

| Command | Description |
| --- | --- |
| `pwd` | Print current path |
| `ls` / `ls -l` | List children (long format shows IDs and status) |
| `cd <name>` | Navigate into a child (supports `..` and `/`) |
| `tree` | Render the subtree from your current node |

### Node Management

| Command | Description |
| --- | --- |
| `mkdir <name>` | Create a child node |
| `rm <name> -f` | Delete a node (soft delete) |
| `rename <name> <new>` | Rename a child node |
| `mv <name> <destId>` | Move a node to a new parent |
| `status <name> <status>` | Set status: `active`, `completed`, `trimmed` |
| `prestige` | Prestige the current node (create a new version) |

### Scheduling

| Command | Description |
| --- | --- |
| `schedule <datetime> [reeffect]` | Set schedule on the current node (e.g. `1/11/2025 3`, `1/11/2025 11:45pm 5`, or `clear`) |
| `calendar` | Show scheduled dates across the tree |
| `dream-time <HH:MM>` | Set nightly dream scheduling time (or `clear`) |

### Notes and Values

| Command | Description |
| --- | --- |
| `notes` | List notes on the current node |
| `note <content>` | Post a note |
| `rm-note <id> -f` | Delete a note |
| `book` | Print the full book of notes from the current node down |
| `contributions` | List contributions for the current node |
| `values` | List key-value pairs |
| `value <key> <value>` | Set a value |
| `goal <key> <goal>` | Set a goal |

### AI

| Command | Description |
| --- | --- |
| `chat <message>` | Chat with AI about the current branch (read and write) |
| `place <message>` | AI-place content into the current branch (write) |
| `query <message>` | Query AI about the current branch (read-only) |

### Understanding Runs

| Command | Description |
| --- | --- |
| `understand [perspective]` | Start an understanding run from the current node |
| `understandings` | List understanding runs |
| `understand-status <runId>` | Check run progress |
| `understand-stop <runId>` | Stop a running understanding run |

---

## Name Matching

All commands accept names or IDs. No quotes needed for multi-word names. Matching is fuzzy:

1. Exact ID or ID prefix
2. Exact name (case-insensitive)
3. Name starts with your query
4. Name contains your query

If multiple matches are found, you will be asked to disambiguate by ID.

---

## How It Works

All commands map to the [Tree REST API](https://tree.tabors.site/about/api/). Your API key and navigation state are stored in `~/.treef-cli/config.json`.
