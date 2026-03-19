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
| `root <name>` | Switch active root tree (alias for use) |
| `mkroot <name>` | Create a new root tree |
| `home` | Leave current tree, return to user home |
| `ideas` | List pending/stuck/processing ideas. `--done` = succeeded, `--all` = everything, `-s <status>` = exact filter |
| `idea <message>` | Send an idea, get an AI response, and auto-navigate to where it was placed |
| `idea-store <content>` | Save a raw idea for later without processing |
| `rm-idea <id> -f` | Delete a raw idea |
| `idea-place <id or text>` | AI-place an idea (fire-and-forget). Pass a raw idea ID or type content directly |
| `idea-auto [on\|off]` | Toggle automatic placement of pending raw ideas every 15 min (Standard plan+). No arg = show current status |
| `idea-transfer <id> <nodeId>` | Transfer a raw idea to a specific node |
| `notes` | List your user-level notes |
| `chats` | In home: your profile chats. In tree: current node's chats |
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
| `mkdir <name>` | Create a child node. Comma-separate for multiple: `mkdir foo, bar, baz` |
| `rm <name> -f` | Delete a node (soft delete) |
| `rename <name> <new>` | Rename a child node |
| `mv <name> <destId>` | Move a node to a new parent |
| `status <name> <status>` | Set status: `active`, `completed`, `trimmed` |
| `prestige` | Prestige the current node (create a new version) |

### Scheduling

Date is `MM/DD/YYYY`, time is `HH:MM` or `HH:MMam/pm`, reeffect is hours (default 0). Omit time for midnight. Omit date for today. Use `clear` to remove.

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
| `chat <message>` | Chat with AI about the current node/branch |
| `chats` | Node chats (current node). `chats tree` = all chats across the whole tree |
| `place <message>` | AI-place content into the current branch (write) |
| `query <message>` | Query AI about the current branch (read-only) |

### Understanding Runs

| Command | Description |
| --- | --- |
| `understand [perspective]` | Start an understanding run from the current node |
| `understandings` | List understanding runs |
| `understand-status <runId>` | Check run progress |
| `understand-stop <runId>` | Stop a running understanding run |

### Blog

Posts from the Tree creator — updates, ideas, and what's coming next. No login required.

| Command | Description |
| --- | --- |
| `blogs` | List all published blog posts with summaries |
| `blog <slug or number>` | Read a post by slug (`blog why-i-built-tree`) or list number (`blog 1`) |

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
