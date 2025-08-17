// electron/main/ipc/handlers/autoencoder.ts

import { spawn, execFile, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface AutoencoderRunConfig {
  dbPath: string;
  trainedModelOutputPath: string;
  convertedModelOutputPath: string;
  trainCombined: boolean;
  trainLeft: boolean;
  trainRight: boolean;
  convertCombined: boolean;
  convertLeft: boolean;
  convertRight: boolean;
}

export async function autoencoderTrainer(config: AutoencoderRunConfig) {
const platform = process.platform;
if (platform === 'linux') {
    await runLinux(config);
    return;
}
if (platform === 'win32') {
    runWindows(config);
    return;
}
if (platform === 'darwin') {
    return; // not implemented. Does VRC even work on Mac?
}
throw new Error(`Unsupported platform: ${platform}`);
}

/* ───────────────────────── Linux implementation ───────────────────────── */

async function runLinux(config: AutoencoderRunConfig) {
  // fast-fail checks
  if (!fs.existsSync(config.dbPath) || !fs.statSync(config.dbPath).isFile()) {
    throw new Error(`dbPath not a file: ${config.dbPath}`);
  }
  fs.mkdirSync(config.trainedModelOutputPath, { recursive: true });
  fs.mkdirSync(config.convertedModelOutputPath, { recursive: true });

  const useSudo = await needsSudoForDocker();
  const dockerCmd = useSudo ? 'sudo docker' : 'docker';

  const bashScript = buildBashScript(config, dockerCmd);

  // Try common terminal emulators; fall back to headless bash if none found.
  const candidates: Array<{ bin: string; args: string[] }> = [
    { bin: 'gnome-terminal', args: ['--', 'bash', '-lc', bashScript] },
    { bin: 'konsole',        args: ['-e', 'bash', '-lc', bashScript] },
    { bin: 'xfce4-terminal', args: ['-e', 'bash', '-lc', bashScript] },
    { bin: 'xterm',          args: ['-e', 'bash', '-lc', bashScript] },
    { bin: 'alacritty',      args: ['-e', 'bash', '-lc', bashScript] },
    { bin: 'kitty',          args: ['bash', '-lc', bashScript] },
    { bin: 'wezterm',        args: ['start', 'bash', '-lc', bashScript] },
  ];

  const choice = candidates.find(c => whichSync(c.bin));
  if (choice) {
    spawn(choice.bin, choice.args, { detached: true, stdio: 'ignore' }).unref();
  } else {
    // headless fallback
    spawn('bash', ['-lc', bashScript], { detached: true, stdio: 'ignore' }).unref();
  }
}

async function needsSudoForDocker(): Promise<boolean> {
  // Linux only: if `docker info` fails with permission denied, use sudo
  return new Promise<boolean>((resolve) => {
    execFile('docker', ['info'], (err, _stdout, stderr) => {
      if (!err) return resolve(false);
      const msg = (stderr || String(err)).toLowerCase();
      resolve(
        msg.includes('permission denied') ||
        msg.includes('got permission denied while trying to connect')
      );
    });
  });
}

function buildBashScript(config: AutoencoderRunConfig, dockerCmd: string) {
  const DB = bashQuote(path.resolve(config.dbPath));
  const TRAINED = bashQuote(path.resolve(config.trainedModelOutputPath));
  const CONVERTED = bashQuote(path.resolve(config.convertedModelOutputPath));

  const lines: string[] = [
    // Fail fast + ensure traps fire through functions/subshells
    'set -Eeuo pipefail',
    // Always show a closing prompt, whether success or failure
    'trap \'status=$?; ' +
      'if [ "$status" -eq 0 ]; then echo; echo "All done."; ' +
      'else echo; echo "An error occurred (exit $status)."; fi; ' +
      'read -p "Press Enter to close..." _\' EXIT',

    'command -v docker >/dev/null 2>&1 || { echo "Docker not found on PATH"; exit 127; }',
    `INPUT_DB="${DB}"`,
    `TRAINED_MODEL_DIR="${TRAINED}"`,
    `CONVERTED_MODEL_DIR="${CONVERTED}"`,
    '[ -f "$INPUT_DB" ] || { echo "ERROR: input_db not a file: $INPUT_DB"; exit 3; }',
    'mkdir -p "$TRAINED_MODEL_DIR" "$CONVERTED_MODEL_DIR"',
  ];

  if (config.trainCombined) {
    lines.push(
      `${dockerCmd} run --gpus all --rm ` +
      `-v "$INPUT_DB":/src/input/database.db ` +
      `-v "$TRAINED_MODEL_DIR":/src/output/ ` +
      `feldhausenryan/ryan9411-eye-tracking:1.0.1-gpu ` +
      `python /src/train_autoencoder_combined.py ` +
      `--db_path=/src/input/database.db --output_dir=/src/output/`
    );
  }
  if (config.trainLeft) {
    lines.push(
      `${dockerCmd} run --gpus all --rm ` +
      `-v "$INPUT_DB":/src/input/database.db ` +
      `-v "$TRAINED_MODEL_DIR":/src/output/ ` +
      `feldhausenryan/ryan9411-eye-tracking:1.0.1-gpu ` +
      `python /src/train_autoencoder_left.py ` +
      `--db_path=/src/input/database.db --output_dir=/src/output/`
    );
  }
  if (config.trainRight) {
    lines.push(
      `${dockerCmd} run --gpus all --rm ` +
      `-v "$INPUT_DB":/src/input/database.db ` +
      `-v "$TRAINED_MODEL_DIR":/src/output/ ` +
      `feldhausenryan/ryan9411-eye-tracking:1.0.1-gpu ` +
      `python /src/train_autoencoder_right.py ` +
      `--db_path=/src/input/database.db --output_dir=/src/output/`
    );
  }
  if (config.convertCombined) {
    lines.push(
      'mkdir -p "$CONVERTED_MODEL_DIR/combined_autoencoder"',
      `${dockerCmd} run --rm ` +
      `-v "$TRAINED_MODEL_DIR":/src/input/ ` +
      `-v "$CONVERTED_MODEL_DIR":/src/output/ ` +
      `feldhausenryan/ryan9411-eye-tracking:1.0.1-tfjs ` +
      `/usr/local/bin/tensorflowjs_converter --input_format=keras ` +
      `/src/input/encoder.h5 /src/output/combined_autoencoder`
    );
  }
  if (config.convertLeft) {
    lines.push(
      'mkdir -p "$CONVERTED_MODEL_DIR/left_autoencoder"',
      `${dockerCmd} run --rm ` +
      `-v "$TRAINED_MODEL_DIR":/src/input/ ` +
      `-v "$CONVERTED_MODEL_DIR":/src/output/ ` +
      `feldhausenryan/ryan9411-eye-tracking:1.0.1-tfjs ` +
      `/usr/local/bin/tensorflowjs_converter --input_format=keras ` +
      `/src/input/encoder_left.h5 /src/output/left_autoencoder`
    );
  }
  if (config.convertRight) {
    lines.push(
      'mkdir -p "$CONVERTED_MODEL_DIR/right_autoencoder"',
      `${dockerCmd} run --rm ` +
      `-v "$TRAINED_MODEL_DIR":/src/input/ ` +
      `-v "$CONVERTED_MODEL_DIR":/src/output/ ` +
      `feldhausenryan/ryan9411-eye-tracking:1.0.1-tfjs ` +
      `/usr/local/bin/tensorflowjs_converter --input_format=keras ` +
      `/src/input/encoder_right.h5 /src/output/right_autoencoder`
    );
  }

  if (
    !config.trainCombined && !config.trainLeft && !config.trainRight &&
    !config.convertCombined && !config.convertLeft && !config.convertRight
  ) {
    lines.push('echo "No actions selected (all flags false). Nothing to do."');
  }

  return lines.join('\n');
}

function bashQuote(p: string) {
  return String(p).replace(/(["\\$`])/g, '\\$1');
}

function whichSync(bin: string): boolean {
  try {
    const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { stdio: 'ignore' });
    return r.status === 0;
  } catch {
    return false;
  }
}

/* ───────────────────────── Windows (WSL2) implementation ───────────────────────── */

function runWindows(config: AutoencoderRunConfig) {
  // Validate on Windows side so you can show immediate UX errors
  if (!fs.existsSync(config.dbPath) || !fs.statSync(config.dbPath).isFile()) {
    throw new Error(`dbPath not a file: ${config.dbPath}`);
  }
  fs.mkdirSync(config.trainedModelOutputPath, { recursive: true });
  fs.mkdirSync(config.convertedModelOutputPath, { recursive: true });

  // Convert host paths → WSL
  const DB_WSL        = toWslPath(path.resolve(config.dbPath));
  const TRAINED_WSL   = toWslPath(path.resolve(config.trainedModelOutputPath));
  const CONVERTED_WSL = toWslPath(path.resolve(config.convertedModelOutputPath));

  // Build the script text (for WSL bash)
  const script = buildWslBashScript({
    db: DB_WSL,
    trainedDir: TRAINED_WSL,
    convertedDir: CONVERTED_WSL,
    flags: {
      trainCombined: config.trainCombined,
      trainLeft: config.trainLeft,
      trainRight: config.trainRight,
      convertCombined: config.convertCombined,
      convertLeft: config.convertLeft,
      convertRight: config.convertRight,
    },
  });

  // Persist the script to a temp file on Windows, then run that file inside WSL
  const { winPath, wslPath } = writeScriptToTemp(script);

  // Prefer Windows Terminal; else use cmd; last resort PowerShell.
  const title = 'Autoencoder Trainer (WSL)';
  const bashInvoke = `bash ${bashQuoteArg(wslPath)}`;

  if (whichSync('wt.exe')) {
    // wt new-tab --title "..." wsl.exe bash -lc "bash /mnt/c/.../run.sh"
    spawn(
      'wt.exe',
      ['new-tab', '--title', title, 'wsl.exe', 'bash', '-lc', bashInvoke],
      { detached: true, stdio: 'ignore' }
    ).unref();
    return;
  }

  if (whichSync('cmd.exe')) {
    // cmd → start a new window that runs wsl directly
    // Note: we pass args separately to avoid additional quoting layers.
    spawn(
      'cmd.exe',
      ['/c', 'start', '""', 'wsl.exe', 'bash', '-lc', bashInvoke],
      { detached: true, stdio: 'ignore' }
    ).unref();
    return;
  }

  // Fallback: PowerShell
  const psCmd = `wsl.exe bash -lc ${psQuoteArg(bashInvoke)}`;
  spawn('powershell.exe', ['-NoExit', '-Command', psCmd], {
    detached: true,
    stdio: 'ignore',
  }).unref();
}

/* ───────────────────────── Build the WSL-side bash script ───────────────────────── */

function buildWslBashScript(opts: {
  db: string;           // /mnt/c/... form, NOT quoted
  trainedDir: string;   // /mnt/c/... form, NOT quoted
  convertedDir: string; // /mnt/c/... form, NOT quoted
  flags: {
    trainCombined: boolean;
    trainLeft: boolean;
    trainRight: boolean;
    convertCombined: boolean;
    convertLeft: boolean;
    convertRight: boolean;
  };
}) {
  const { db, trainedDir, convertedDir, flags } = opts;

  const q = (s: string) => bashQuoteArg(s); // quote for bash vars/args

  const lines: string[] = [
    // Fail fast; always prompt on exit (success/fail)
    'set -Eeuo pipefail',
    'trap \'status=$?; echo; ' +
      'if [ "$status" -eq 0 ]; then echo "All done."; ' +
      'else echo "An error occurred (exit $status)."; fi; ' +
      'read -p "Press Enter to close..." _\' EXIT',

    'command -v docker >/dev/null 2>&1 || { echo "Docker not found in WSL PATH"; exit 127; }',
    `INPUT_DB=${q(db)}`,
    `TRAINED_MODEL_DIR=${q(trainedDir)}`,
    `CONVERTED_MODEL_DIR=${q(convertedDir)}`,
    '[ -f "$INPUT_DB" ] || { echo "ERROR: input_db not a file: $INPUT_DB"; exit 3; }',
    'mkdir -p "$TRAINED_MODEL_DIR" "$CONVERTED_MODEL_DIR"',
  ];

  const dockerCmd = 'docker';

  if (flags.trainCombined) {
    lines.push(
      `${dockerCmd} run --gpus all --rm ` +
        `-v "$INPUT_DB":/src/input/database.db ` +
        `-v "$TRAINED_MODEL_DIR":/src/output/ ` +
        `feldhausenryan/ryan9411-eye-tracking:1.0.1-gpu ` +
        `python /src/train_autoencoder_combined.py ` +
        `--db_path=/src/input/database.db --output_dir=/src/output/`
    );
  }
  if (flags.trainLeft) {
    lines.push(
      `${dockerCmd} run --gpus all --rm ` +
        `-v "$INPUT_DB":/src/input/database.db ` +
        `-v "$TRAINED_MODEL_DIR":/src/output/ ` +
        `feldhausenryan/ryan9411-eye-tracking:1.0.1-gpu ` +
        `python /src/train_autoencoder_left.py ` +
        `--db_path=/src/input/database.db --output_dir=/src/output/`
    );
  }
  if (flags.trainRight) {
    lines.push(
      `${dockerCmd} run --gpus all --rm ` +
        `-v "$INPUT_DB":/src/input/database.db ` +
        `-v "$TRAINED_MODEL_DIR":/src/output/ ` +
        `feldhausenryan/ryan9411-eye-tracking:1.0.1-gpu ` +
        `python /src/train_autoencoder_right.py ` +
        `--db_path=/src/input/database.db --output_dir=/src/output/`
    );
  }
  if (flags.convertCombined) {
    lines.push(
      'mkdir -p "$CONVERTED_MODEL_DIR/combined_autoencoder"',
      `${dockerCmd} run --rm ` +
        `-v "$TRAINED_MODEL_DIR":/src/input/ ` +
        `-v "$CONVERTED_MODEL_DIR":/src/output/ ` +
        `feldhausenryan/ryan9411-eye-tracking:1.0.1-tfjs ` +
        `/usr/local/bin/tensorflowjs_converter --input_format=keras ` +
        `/src/input/encoder.h5 /src/output/combined_autoencoder`
    );
  }
  if (flags.convertLeft) {
    lines.push(
      'mkdir -p "$CONVERTED_MODEL_DIR/left_autoencoder"',
      `${dockerCmd} run --rm ` +
        `-v "$TRAINED_MODEL_DIR":/src/input/ ` +
        `-v "$CONVERTED_MODEL_DIR":/src/output/ ` +
        `feldhausenryan/ryan9411-eye-tracking:1.0.1-tfjs ` +
        `/usr/local/bin/tensorflowjs_converter --input_format=keras ` +
        `/src/input/encoder_left.h5 /src/output/left_autoencoder`
    );
  }
  if (flags.convertRight) {
    lines.push(
      'mkdir -p "$CONVERTED_MODEL_DIR/right_autoencoder"',
      `${dockerCmd} run --rm ` +
        `-v "$TRAINED_MODEL_DIR":/src/input/ ` +
        `-v "$CONVERTED_MODEL_DIR":/src/output/ ` +
        `feldhausenryan/ryan9411-eye-tracking:1.0.1-tfjs ` +
        `/usr/local/bin/tensorflowjs_converter --input_format=keras ` +
        `/src/input/encoder_right.h5 /src/output/right_autoencoder`
    );
  }

  if (
    !flags.trainCombined &&
    !flags.trainLeft &&
    !flags.trainRight &&
    !flags.convertCombined &&
    !flags.convertLeft &&
    !flags.convertRight
  ) {
    lines.push('echo "No actions selected (all flags false). Nothing to do."');
  }

  return lines.join('\n');
}

/* ───────────────────────── Windows↔WSL helpers ───────────────────────── */

function writeScriptToTemp(scriptText: string): { winPath: string; wslPath: string } {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'autoenc-'));
  const winPath = path.join(tmpBase, 'run.sh');
  fs.writeFileSync(winPath, scriptText, { encoding: 'utf8' });
  // Make it executable from WSL side (bash will run it regardless, but chmod helps if user runs directly)
  try {
    // Best-effort chmod via wsl; ignore errors if WSL not present at dev-time
    spawnSync('wsl.exe', ['chmod', '+x', toWslPath(winPath)], { stdio: 'ignore' });
  } catch {}
  return { winPath, wslPath: toWslPath(winPath) };
}

function toWslPath(p: string): string {
  const norm = p.replace(/\\/g, '/');
  const m = norm.match(/^([A-Za-z]):(\/.*)$/);
  if (m) return `/mnt/${m[1].toLowerCase()}${m[2]}`;
  return norm; // already /mnt/... or UNC (UNC mounts usually won’t work inside docker; prefer local drives)
}

// Quote a single bash arg: 'foo' → 'foo' with proper escaping
function bashQuoteArg(s: string): string {
  // Enclose in single quotes, escape embedded single quotes: ' → '\'' (close, escape, reopen)
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

// For PowerShell’s -Command single-arg quoting
function psQuoteArg(s: string): string {
  // Wrap in single quotes; double up embedded single quotes
  return `'${String(s).replace(/'/g, "''")}'`;
}