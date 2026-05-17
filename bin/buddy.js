#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from '../src/commands/init.js';
import { openCommand } from '../src/commands/open.js';
import { statusCommand } from '../src/commands/status.js';
import { linkCommand } from '../src/commands/link.js';
import { precheckCommand } from '../src/commands/precheck.js';
import { agentCommand } from '../src/commands/agent.js';
import { tourCommand } from '../src/commands/tour.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const program = new Command();

program
  .name('buddy')
  .description('Your friendly repo onboarding buddy. Knowledge lives in .buddy/ and travels with the repo.')
  .version(pkg.version);

program
  .command('init')
  .description('Create .buddy/ in the current repo, install the Buddy agent for all CLIs, and auto-open the home page.')
  .option('--no-open', 'Do not auto-open the home page after init.')
  .option('--no-install-agent', 'Do not install the Buddy agent.')
  .option('--user-agent', 'Install the Buddy agent at user level instead of repo level.')
  .option('--force', 'Re-scaffold .buddy/ even if files exist (will not overwrite).')
  .action(initCommand);

program
  .command('open [doc]')
  .description('Open a Buddy doc. With no argument, opens the home page (.buddy/README_FOR_HUMANS.md).')
  .option('--no-open', 'Print the resolved path instead of opening.')
  .action(openCommand);

program
  .command('status')
  .description('Show whether .buddy/ is up to date with the latest commit.')
  .action(statusCommand);

program
  .command('link <url>')
  .description('Capture a documentation URL into .buddy/LINKS.md and INDEX/links.json (secrets are redacted).')
  .option('-t, --title <title>', 'Title for the link.')
  .option('-d, --desc <description>', 'Short description.')
  .option('--tags <tags>', 'Comma-separated tags (e.g. setup,architecture).')
  .option('-r, --relevance <relevance>', 'must-read | helpful | optional', 'helpful')
  .action(linkCommand);

program
  .command('precheck')
  .description('Show .buddy/ docs that are likely stale based on changes since last index.')
  .action(precheckCommand);

program
  .command('agent [subcommand]')
  .description('Manage the Buddy agent. Subcommands: install (default) | list | path')
  .option('--user', 'Install at user level instead of repo level.')
  .option('--force', 'Overwrite an existing buddy.md at the destination.')
  .option('--claude', 'Install for Claude Code only (.claude/agents/).')
  .option('--all', 'Install for all CLIs (Copilot CLI + Claude Code).')
  .action(agentCommand);

program
  .command('tour')
  .description('Generate (and open) an interactive .buddy/tour.html — single file, no install.')
  .option('--no-open', 'Generate the file but do not open it in a browser.')
  .action(tourCommand);

program.parseAsync(process.argv).catch((err) => {
  console.error(`buddy: ${err.message}`);
  process.exit(1);
});
