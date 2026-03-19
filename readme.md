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
```

```
roots                      # list your trees

root Life Plan             # switch into a tree

ls                         # list children

mkdir Injured, Fitness        # create multiple new children

cd Injured                  # navigate deeper

tree                       # render the subtree

chat went to doctor appointment today. told me to rest to recover my ankle

cd ..

cd Fitness

place create a plan to workout 3 times a week

chat i did the 20 pushups. what should i do now?

cd /

understand tell me about my general physical and mental trends

exit                       # leave the shell
```

---

## Commands

### Session

| Command             | Description                                       |
| ------------------- | ------------------------------------------------- |
| `start` / `shell`   | Launch interactive shell                          |
| `stop` / `exit`     | Exit the shell                                    |
| `login --key <key>` | Authenticate with your API key                    |
| `logout`            | Clear stored credentials                          |
| `whoami`            | Show current login, plan, energy, and active tree |

---

### User Home

Commands available without entering a tree.

| Command                       | Description                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `roots`                       | List all your root trees                                                                                            |
| `use <name>`                  | Switch active root tree                                                                                             |
| `root <name>`                 | Switch active root tree (alias for use)                                                                             |
| `mkroot <name>`               | Create a new root tree                                                                                              |
| `retire/leave [name] -f`      | Leave a shared tree, or delete if you are the sole owner. Name optional if inside a tree                            |
| `home`                        | Leave current tree, return to user home                                                                             |
| `ideas`                       | List pending/stuck/processing ideas. Flags: `--pending` `--processing` `--stuck` `--done` `--all`. Stack to combine |
| `idea <message>`              | Send an idea from anywhere — AI places it in the right tree and navigates you there                                 |
| `idea-store <content>`        | Save a raw idea for later without processing                                                                        |
| `rm-idea <id> -f`             | Delete a raw idea                                                                                                   |
| `idea-place <id or message>`  | AI-place an idea (fire-and-forget). Pass a raw idea ID or type content directly                                     |
| `idea-auto [on\|off]`         | Toggle automatic placement of pending raw ideas every 15 min (Standard plan+). No arg = show current status         |
| `idea-transfer <id> <nodeId>` | Manually transfer a raw idea to a specific node (use when you know exactly where it should go or don't want AI)     |
| `notes`                       | List your user-level notes                                                                                          |
| `tags/mail`                   | List notes where you've been @tagged by other users                                                                 |
| `chats`                       | In home: all AI chats across all your trees. In tree: current node's chats                                          |
| `contributions`               | List your recent contributions                                                                                      |
| `share-token [token]`         | Show your share token, or set a new one (`share-token <token>`)                                                     |
| `share idea <id>`             | Public link to a raw idea (no token required)                                                                       |

---

### Tree Navigation

Commands available once you are inside a tree.

| Command        | Description                                                               |
| -------------- | ------------------------------------------------------------------------- |
| `pwd`          | Print current path                                                        |
| `ls` / `ls -l` | List children (long format shows IDs and status)                          |
| `cd <name>`    | Navigate into a child. Supports `..`, `/`, `-r` (search whole tree), and path chaining (`cd Health/Workouts`) |
| `tree`         | Render the subtree from your current node. Flags: `--active`, `--completed`, `--trimmed` to filter by status |

Nodes have three statuses: **active** (green), **completed** (gray), **trimmed** (dim). Use `complete`, `activate`, or `trim` to change status recursively.

### Node Management

| Command                  | Description                                                             |
| ------------------------ | ----------------------------------------------------------------------- |
| `mkdir <name>`           | Create a child node. Comma-separate for multiple: `mkdir foo, bar, baz` |
| `rm <name> -f`           | Delete a node (soft delete)                                             |
| `rename <name> <new>`    | Rename a child node                                                     |
| `mv <name> <destId>`     | Move a node to a new parent                                             |
| `complete`               | Set current node and all children to completed                                |
| `activate`               | Set current node and all children to active                                   |
| `trim`                   | Set current node and all children to trimmed                                  |
| `prestige`               | Prestige the current node (create a new version)                        |

### Scheduling

Date is `MM/DD/YYYY`, time is `HH:MM` or `HH:MMam/pm`, reeffect is hours (default 0). Omit time for midnight. Omit date for today. Use `clear` to remove.

| Command                          | Description                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `schedule <datetime> [reeffect]` | Set schedule on the current node (e.g. `1/11/2025 3`, `1/11/2025 11:45pm 5`, or `clear`) |
| `calendar`                       | Show scheduled dates across the tree                                                     |
| `dream-time <HH:MM>`             | Set nightly dream scheduling time (or `clear`)                                           |

### Notes and Values

| Command               | Description                                             |
| --------------------- | ------------------------------------------------------- |
| `notes`               | List notes on the current node                          |
| `note <content>`      | Post a note                                             |
| `rm-note <id> -f`     | Delete a note                                           |
| `book`                | Print the full book of notes from the current node down |
| `contributions`       | List contributions for the current node                 |
| `values`              | List key-value pairs                                    |
| `value <key> <value>` | Set a value                                             |
| `goal <key> <goal>`   | Set a goal                                              |

### Collaboration

| Command                        | Description                                                              |
| ------------------------------ | ------------------------------------------------------------------------ |
| `team`                         | Show the owner and contributors for the current tree                     |
| `invite <username or userId>`  | Invite a user to the current tree                                        |
| `invites`                      | List your pending invites                                                |
| `invite accept <id>`           | Accept a pending invite                                                  |
| `invite deny <id>`             | Decline a pending invite                                                 |
| `kick <username or userId>`    | Remove a contributor from the current tree                               |
| `owner <username or userId>`   | Transfer tree ownership to another contributor                           |

### Links & Sharing (in a tree)

| Command              | Description                                                         |
| -------------------- | ------------------------------------------------------------------- |
| `link`               | Clickable link to your current node (uses share token)              |
| `link root`          | Link to the tree root                                               |
| `link book`          | Link to the book view                                               |
| `link gateway`       | Link to the gateway channels for the tree                           |
| `link note <id>`     | Link to a specific note                                             |
| `share note <id>`    | Public link to a note (no token required)                           |
| `share book`         | Generate a public book share link from current node (TOC included)  |

**From home:**

| Command              | Description                                                         |
| -------------------- | ------------------------------------------------------------------- |
| `link`               | Link to your user profile                                           |
| `link ideas`         | Link to your raw ideas                                              |
| `link idea <id>`     | Link to a specific raw idea                                         |

### AI

| Command           | Description                                                                    |
| ----------------- | ------------------------------------------------------------------------------ |
| `chat <message>`  | Chat with AI about the current node/branch — returns a conversational response |
| `place <message>` | AI writes content into the current branch based on your message                |
| `query <message>` | Ask AI about the current branch without writing anything (read-only)           |
| `chats`           | View past AI chat history for the current node                                 |
| `chats tree`      | View all AI chat history across the whole tree                                 |

### Understanding Runs

| Command                     | Description                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `understand [perspective]`  | Start an understanding run from the current node. Waits and returns the final encoding |
| `understandings`            | List understanding runs                                                                |
| `understand-status <runId>` | Check run progress                                                                     |
| `understand-stop <runId>`   | Stop a running understanding run                                                       |

### Blog

Posts from the Tree creator — updates, ideas, and what's coming next. No login required.

| Command                 | Description                                                             |
| ----------------------- | ----------------------------------------------------------------------- |
| `blogs`                 | List all published blog posts with summaries                            |
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
