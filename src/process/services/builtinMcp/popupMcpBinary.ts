import { app } from 'electron';
import fs from 'fs';
import path from 'path';

type SupportedPlatform = 'win32' | 'darwin' | 'linux';
type SupportedArch = 'x64' | 'arm64';

const PLATFORM_PREFIX: Record<SupportedPlatform, string> = {
  win32: 'win',
  darwin: 'macos',
  linux: 'linux',
};

const ARCH_FOLDER: Record<SupportedArch, string> = {
  x64: 'x64',
  arm64: 'arm64',
};

const ARCH_FILE_TAG: Record<SupportedPlatform, Record<SupportedArch, string>> = {
  win32: { x64: 'x64', arm64: 'arm64' },
  darwin: { x64: 'x64', arm64: 'arm64' },
  linux: { x64: 'x86_64', arm64: 'arm64' },
};

const resolveResourceBinDirs = (): string[] => {
  const appPath = app.getAppPath();
  if (app.isPackaged) {
    return [path.join(process.resourcesPath, 'bin'), path.join(process.resourcesPath, 'resources', 'bin')];
  }

  return [path.join(appPath, 'resources', 'bin'), path.join(appPath, '..', 'resources', 'bin'), path.join(appPath, '..', '..', 'resources', 'bin'), path.join(process.cwd(), 'resources', 'bin')];
};

const ensureExecutable = (filePath: string) => {
  if (process.platform === 'win32') return;
  try {
    fs.chmodSync(filePath, 0o755);
  } catch {
    // Best-effort: rely on packaged permissions if chmod fails.
  }
};

const findMatchingBinary = (dirPath: string, namePattern: RegExp): string | null => {
  try {
    if (!fs.existsSync(dirPath)) return null;
    const entries = fs.readdirSync(dirPath);
    const match = entries.find((entry) => namePattern.test(entry));
    return match ? path.join(dirPath, match) : null;
  } catch {
    return null;
  }
};

export const resolvePopupMcpBinaryPath = (): string | null => {
  const platform = process.platform as SupportedPlatform;
  const arch = process.arch as SupportedArch;
  if (!PLATFORM_PREFIX[platform] || !ARCH_FOLDER[arch]) {
    return null;
  }

  const platformPrefix = PLATFORM_PREFIX[platform];
  const archFolder = ARCH_FOLDER[arch];
  const archFileTag = ARCH_FILE_TAG[platform][arch];
  const exeName = platform === 'win32' ? 'popup-mcp.exe' : 'popup-mcp';

  const baseDirs = resolveResourceBinDirs();
  const archPattern = platform === 'linux' && arch === 'x64' ? '(x86_64|x64)' : archFileTag;
  const legacyPattern = new RegExp(`^popup-mcp-.*-${platformPrefix}-${archPattern}(\\.exe)?$`, 'i');

  for (const baseDir of baseDirs) {
    const standardCandidate = path.join(baseDir, 'popup-mcp', `${platformPrefix}-${archFolder}`, exeName);
    if (fs.existsSync(standardCandidate)) {
      ensureExecutable(standardCandidate);
      return standardCandidate;
    }

    const directCandidates = [path.join(baseDir, 'popup-mcp', exeName), path.join(baseDir, exeName)];
    const directMatch = directCandidates.find((candidate) => fs.existsSync(candidate));
    if (directMatch) {
      ensureExecutable(directMatch);
      return directMatch;
    }

    const legacyDirs = [path.join(baseDir, 'popup-mcp'), baseDir];
    for (const legacyDir of legacyDirs) {
      const legacyMatch = findMatchingBinary(legacyDir, legacyPattern);
      if (legacyMatch) {
        ensureExecutable(legacyMatch);
        return legacyMatch;
      }
    }
  }

  return null;
};
