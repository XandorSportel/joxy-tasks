const vscode = require('vscode');

class ConfiguredTaskItem extends vscode.TreeItem {
  constructor(task) {
    super(task.label, vscode.TreeItemCollapsibleState.None);
    this.task = task;
    this.description = task.description;
    const commands = getCommands(task);
    const executionLabel = commands.length > 1
      ? `${task.run === 'sequential' ? 'Sequential' : 'Parallel'} (${commands.length})`
      : 'Single command';
    this.tooltip = new vscode.MarkdownString(
      `**${escapeMarkdown(task.label)}** — ${executionLabel}\n\n${commands.map((command) => `\`${command}\``).join('\n\n')}`
    );
    this.iconPath = new vscode.ThemeIcon('play');
    this.contextValue = 'configuredTask';
    this.command = {
      command: 'joxyTasks.runTask',
      title: 'Run Task',
      arguments: [task]
    };
  }
}

class TasksProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item) {
    return item;
  }

  getChildren() {
    const tasks = vscode.workspace
      .getConfiguration('joxyTasks')
      .get('tasks', []);

    return tasks
      .filter(isValidTask)
      .map((task) => new ConfiguredTaskItem(task));
  }

  dispose() {
    this._onDidChangeTreeData.dispose();
  }
}

function isValidTask(task) {
  const commands = getCommands(task);
  return task
    && typeof task.label === 'string'
    && task.label.trim().length > 0
    && commands.length > 0
    && commands.every((command) =>
      typeof command === 'string' && command.trim().length > 0
    )
    && (task.run === undefined
      || task.run === 'parallel'
      || task.run === 'sequential');
}

function getCommands(task) {
  if (!task) {
    return [];
  }

  if (Array.isArray(task.commands)) {
    return task.commands;
  }

  return typeof task.command === 'string' ? [task.command] : [];
}

function escapeMarkdown(value) {
  return value.replace(/[\\`*_{}[\]()<>#+\-.!|]/g, '\\$&');
}

async function chooseWorkspaceFolder() {
  const folders = vscode.workspace.workspaceFolders;

  if (!folders || folders.length === 0) {
    await vscode.window.showErrorMessage(
      'Open a folder or workspace before running a task.'
    );
    return undefined;
  }

  const items = folders.map((folder) => ({
    label: folder.name,
    description: folder.uri.fsPath,
    folder
  }));

  const selected = await vscode.window.showQuickPick(items, {
    title: 'Run task in workspace folder',
    placeHolder: 'Choose a workspace folder',
    matchOnDescription: true
  });

  return selected?.folder;
}

async function runConfiguredTask(taskDefinition) {
  if (!isValidTask(taskDefinition)) {
    await vscode.window.showErrorMessage('This task configuration is invalid.');
    return;
  }

  const folder = await chooseWorkspaceFolder();
  if (!folder) {
    return;
  }

  const commands = getCommands(taskDefinition);

  if (commands.length === 1) {
    await startTask(taskDefinition, commands[0], folder, 0);
    return;
  }

  if (taskDefinition.run === 'sequential') {
    for (let index = 0; index < commands.length; index += 1) {
      const exitCode = await runTaskAndWait(
        taskDefinition,
        commands[index],
        folder,
        index
      );

      if (exitCode !== 0) {
        await vscode.window.showErrorMessage(
          `Task "${taskDefinition.label}" stopped after command ${index + 1} exited with code ${exitCode}.`
        );
        return;
      }
    }
    return;
  }

  await Promise.all(commands.map((command, index) =>
    startTask(taskDefinition, command, folder, index)
  ));
}

function createTask(taskDefinition, command, folder, index) {
  const commands = getCommands(taskDefinition);
  const name = commands.length > 1
    ? `${taskDefinition.label} (${index + 1}/${commands.length})`
    : taskDefinition.label;

  const task = new vscode.Task(
    { type: 'joxyTasks', command, index },
    folder,
    name,
    'Joxy Tasks',
    new vscode.ShellExecution(command)
  );

  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    panel: vscode.TaskPanelKind.Dedicated,
    clear: false
  };

  return task;
}

async function startTask(taskDefinition, command, folder, index) {
  const task = createTask(taskDefinition, command, folder, index);
  return vscode.tasks.executeTask(task);
}

async function runTaskAndWait(taskDefinition, command, folder, index) {
  const execution = await startTask(taskDefinition, command, folder, index);

  return new Promise((resolve) => {
    const subscription = vscode.tasks.onDidEndTaskProcess((event) => {
      if (event.execution === execution) {
        subscription.dispose();
        resolve(event.exitCode);
      }
    });
  });
}

function activate(context) {
  const provider = new TasksProvider();

  context.subscriptions.push(
    provider,
    vscode.window.registerTreeDataProvider('joxyTasks.taskList', provider),
    vscode.commands.registerCommand('joxyTasks.runTask', runConfiguredTask),
    vscode.commands.registerCommand('joxyTasks.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('joxyTasks.openSettings', () =>
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        '@ext:XandorSportel.joxy-tasks joxyTasks.tasks'
      )
    ),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('joxyTasks.tasks')) {
        provider.refresh();
      }
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
