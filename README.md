# Tasks

This VS Code extension adds a **Tasks** icon to the Activity Bar. It lists
commands configured in VS Code settings. Selecting a command asks which folder
in the current workspace should be used, then runs the command in that folder.

## Configuration

Add tasks to your user or workspace `settings.json`:

```json
{
  "joxyTasks.tasks": [
    {
      "label": "Start development server",
      "command": "npm run dev",
      "description": "Runs the local app"
    },
    {
      "label": "Run tests",
      "command": "npm test"
    },
    {
      "label": "Start everything",
      "commands": [
        "npm run api",
        "npm run frontend"
      ],
      "run": "parallel"
    },
    {
      "label": "Build and deploy",
      "commands": [
        "npm run build",
        "npm run deploy"
      ],
      "run": "sequential"
    }
  ]
}
```

Open a folder or a multi-root workspace, click the **Tasks** icon in the
Activity Bar, and select a task. The extension always asks which workspace
folder should be the task's working directory.

Use `command` for a single command. Use `commands` with `run` set to
`parallel` or `sequential` for multiple commands. Parallel commands start at
the same time in separate task terminals. Sequential commands run one at a
time; if a command fails, the remaining commands are not started.

## Development

Open this directory in VS Code and press `F5` to launch an Extension
Development Host. Run `npm run check` to perform a JavaScript syntax check.

Package the version declared in `package.json`:

```powershell
npm run package
```

Install a packaged version by passing its version number:

```powershell
npm run install:vsix -- 1.1.0
```

When the version is omitted, the installer asks for it interactively and uses
the current `package.json` version as the default. To package and then install
in one command, run:

```powershell
npm run deploy
```
