# tree-cli

A terminal CLI for [Tree](https://tree.tabors.site) — navigate and manage your trees exactly like a filesystem.

## Install

```bash
npm install -g tree-cli
```

## Authentication

Get your API key from your Tree profile page at https://tree.tabors.site/api/v1/user/:USERID/api-keys?html (replacing userId with your own) then:

```bash
tree login --key YOUR_API_KEY --user YOUR_USER_ID
```

## Usage

```bash
# Check who you're logged in as
tree whoami

# List your root trees
tree roots

# Switch to a different root tree
tree use "My Projects"

# --- Navigation ---
tree pwd                # print current path
tree ls                 # list children of current node
tree ls -l              # long format (ID + status)
tree cd Projects        # navigate into a child node
tree cd ..              # go up one level
tree cd /               # jump back to root

# --- Full tree view ---
tree tree               # render the whole tree

# --- Node management ---
tree mkdir "New Node"   # create a child node here
tree rm "Old Node" -f   # delete a node (soft delete, -f to confirm)
tree rename "Old" "New" # rename a child node
tree mv "Node" <destId> # move a node to a different parent
tree status "Node" completed  # set status: active|completed|trimmed

# --- Notes (like file contents) ---
tree notes              # list notes on current node
tree note "your idea"   # post a new note
tree cat <noteId>       # view a note
tree rm-note <noteId> -f  # delete a note

# --- Values (key-value store on nodes) ---
tree values             # list values on current node
tree set revenue 42000  # set a value

# --- AI ---
tree chat "what's in this tree?"   # conversational AI on current tree
tree place "flights cheaper March" # AI-place content (faster, no reply)

# --- Root management ---
tree mkroot "New Tree"  # create a new root tree
```

## How It Works

All commands map directly to the [Tree REST API](https://tree.tabors.site/about/api/). Your API key and current navigation state (which tree, which node path) are stored locally in `~/.tree-cli/config.json`.

`cd` doesn't make an API call — it resolves the child node ID from the `ls` response and pushes it onto a local path stack. All other commands use the stack to know which node to operate on.

## Command → Endpoint Map

| Command  | Endpoint                            |
| -------- | ----------------------------------- |
| `ls`     | `GET /node/:nodeId/0`               |
| `mkdir`  | `POST /node/:nodeId/createChild`    |
| `rm`     | `POST /node/:nodeId/delete`         |
| `mv`     | `POST /node/:nodeId/updateParent`   |
| `rename` | `POST /node/:nodeId/0/editName`     |
| `status` | `POST /node/:nodeId/0/editStatus`   |
| `notes`  | `GET /node/:nodeId/0/notes`         |
| `note`   | `POST /node/:nodeId/0/notes`        |
| `cat`    | `GET /node/:nodeId/0/notes/:noteId` |
| `values` | `GET /node/:nodeId/0/values`        |
| `set`    | `POST /node/:nodeId/0/value`        |
| `chat`   | `POST /root/:rootId/chat`           |
| `place`  | `POST /root/:rootId/place`          |
| `roots`  | `GET /user/:userId`                 |
| `mkroot` | `POST /user/:userId/createRoot`     |
