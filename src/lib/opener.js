import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { platform } from 'node:os';

// Open a file with the OS default app (or $EDITOR/$VISUAL when set).
// Returns { opened: boolean, command: string|null, reason: string|null }.
export function openFile(filePath, { silent = false } = {}) {
  if (process.env.BUDDY_NO_OPEN === '1') {
    return { opened: false, command: null, reason: 'BUDDY_NO_OPEN=1' };
  }

  if (!existsSync(filePath)) {
    return { opened: false, command: null, reason: `File not found: ${filePath}` };
  }

  const editor = process.env.VISUAL || process.env.EDITOR;
  if (editor) {
    return launch(editor, [filePath], silent);
  }

  const p = platform();
  if (p === 'win32') {
    // Use cmd /c start so we don't block. Empty string is the window title.
    return launch('cmd', ['/c', 'start', '', filePath], silent);
  }
  if (p === 'darwin') {
    return launch('open', [filePath], silent);
  }
  return launch('xdg-open', [filePath], silent);
}

function launch(cmd, args, silent) {
  try {
    const child = spawn(cmd, args, {
      detached: true,
      stdio: silent ? 'ignore' : 'inherit',
      shell: false,
    });
    child.unref();
    return { opened: true, command: `${cmd} ${args.join(' ')}`, reason: null };
  } catch (err) {
    return { opened: false, command: cmd, reason: err.message };
  }
}
