# treef-cli

CLI for [Tree](https://tree.tabors.site) — navigate and manage your trees like a filesystem.

**https://tree.tabors.site**

## Install

```bash
npm install -g treef-cli
```

## Authentication

Get your API key from your Tree profile page at https://tree.tabors.site/api/v1/user/:USERID/api-keys?html (replacing :USERID with your own), then:

```bash
treef login --key YOUR_API_KEY
```

## Quick Start

```bash
# Start the interactive shell
treef start

# Or run commands directly
treef roots
treef use Life Plan
treef ls
treef cd Health
treef tree
```

## Commands

### Getting Started

| Command | Description |
| ------- | ----------- |
| `start` / `shell` | Start interactive shell |
| `stop` / `exit` | Exit the shell |
| `login --key <key>` | Authenticate with your API key |
| `logout` | Clear stored credentials |
| `whoami` | Show current login and active tree |

### User Home (no tree required)

| Command | Description |
| ------- | ----------- |
| `roots` | List all your root trees |
| `use <name>` | Switch active root tree |
| `mkroot <name>` | Create a new root tree |
| `home` | Leave current tree, go back to user home |
| `ideas` | List your raw ideas |
| `idea <content>` | Create a new raw idea |
| `rm-idea <id> -f` | Delete a raw idea |
| `idea-place <id>` | AI-place a raw idea into the best tree |
| `idea-transfer <id> <nodeId>` | Transfer a raw idea to a specific node |

### Navigation (inside a tree)

| Command | Description |
| ------- | ----------- |
| `pwd` | Print current path |
| `ls` / `ls -l` | List children (long format shows IDs + status) |
| `cd <name>` | Navigate into a child (supports `..` and `/`) |
| `tree` | Render subtree from the node you are in |

### Node Management

| Command | Description |
| ------- | ----------- |
| `mkdir <name>` | Create a child node |
| `rm <name> -f` | Delete a node (soft delete) |
| `rename <name> <new>` | Rename a child node |
| `mv <name> <destId>` | Move a node to a new parent |
| `status <name> <status>` | Set status: active, completed, trimmed |

### Notes & Values

| Command | Description |
| ------- | ----------- |
| `notes` | List notes on the node you are in |
| `note <content>` | Post a note |
| `rm-note <id> -f` | Delete a note |
| `values` | List key-value pairs |
| `set <key> <value>` | Set a value |

### AI

| Command | Description |
| ------- | ----------- |
| `chat <message>` | Chat with AI about the branch you are in |
| `place <message>` | AI-place content into the branch you are in |

### Understanding Runs

| Command | Description |
| ------- | ----------- |
| `understand [perspective]` | Start an understanding run from the node you are in |
| `understandings` | List understanding runs |
| `understand-status <runId>` | Check run progress |
| `understand-stop <runId>` | Stop a running understanding run |

## Name Matching

All commands accept names or IDs. No quotes needed for multi-word names. Matching is fuzzy:

1. Exact ID or ID prefix
2. Exact name (case-insensitive)
3. Name starts with your query
4. Name contains your query

If multiple matches are found, you'll be asked to disambiguate by ID.

## How It Works

All commands map to the [Tree REST API](https://tree.tabors.site/about/api/). Your API key and navigation state are stored in `~/.tree-cli/config.json`.
