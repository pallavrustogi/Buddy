import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { platform } from 'node:os';
import { extname } from 'node:path';

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
  const isHtml = /\.(html?|htm)$/i.test(extname(filePath));

  // For HTML on any platform, prefer a real browser over $EDITOR / file
  // association (which on Windows can be Notepad if the user changed it).
  if (isHtml) {
    const browserResult = openInBrowser(filePath, silent);
    if (browserResult) return browserResult;
  }

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

// Try to open an HTML file in a real browser. Returns a result on success,
// or null if no known browser was found (caller should fall back).
function openInBrowser(filePath, silent) {
  const p = platform();
  if (p === 'win32') {
    // Try common browsers via `where.exe` (resolves PATH + App Paths registry).
    const candidates = ['msedge', 'chrome', 'brave', 'firefox'];
    for (const exe of candidates) {
      if (whichWin(exe)) {
        return launch('cmd', ['/c', 'start', '', exe, filePath], silent);
      }
    }
    // Last resort: ask Windows to open the file via its URL protocol handler.
    // This uses the default browser for file:// URLs, bypassing the .html
    // file association (which may be Notepad).
    return launch('rundll32', ['url.dll,FileProtocolHandler', filePath], silent);
  }
  if (p === 'darwin') {
    // -t would force a text editor; default `open` uses the default browser
    // for .html, which is what we want.
    return launch('open', [filePath], silent);
  }
  // Linux: xdg-open honors the .html mimetype association (usually a browser).
  return launch('xdg-open', [filePath], silent);
}

function whichWin(exe) {
  try {
    const r = spawnSync('where.exe', [exe], { stdio: 'ignore' });
    return r.status === 0;
  } catch {
    return false;
  }
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
