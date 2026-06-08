import { app } from "electron";
import path from "path";
import { exec, execSync } from "child_process";
import fs from "fs";

export interface JobspyOptions {
  query: string;
  location: string;
  sites?: string; // comma separated
  results?: number;
  hours?: number;
  remote?: boolean;
}

/**
 * Resolve the jobspy native directory.
 * - In development: <project>/native/jobspy
 * - In production:  <resources>/jobspy  (via extraResources)
 */
function getJobspyDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "jobspy");
  }

  let basePath = app.getAppPath();
  if (basePath.includes("dist-electron")) {
    basePath = path.join(basePath, "..", "..");
  }
  return path.join(basePath, "native", "jobspy");
}

/**
 * Get the path to the Python binary inside the venv.
 */
function getVenvPython(nativeDir: string): string {
  return process.platform === "win32"
    ? path.join(nativeDir, "venv", "Scripts", "python.exe")
    : path.join(nativeDir, "venv", "bin", "python");
}

/**
 * Find a working system Python (3.x) on the user's machine.
 */
function findSystemPython(): string | null {
  const candidates =
    process.platform === "win32"
      ? ["python", "python3", "py -3"]
      : ["python3", "python"];

  for (const cmd of candidates) {
    try {
      const version = execSync(`${cmd} --version 2>&1`, {
        timeout: 5000,
      })
        .toString()
        .trim();
      if (version.startsWith("Python 3")) {
        return cmd;
      }
    } catch {
      // not found, try next
    }
  }
  return null;
}

/**
 * Auto-provision the venv and install requirements.
 * Runs synchronously so the caller can await it once and retry.
 */
function setupVenv(nativeDir: string): void {
  const systemPython = findSystemPython();
  if (!systemPython) {
    throw new Error(
      "Python 3 is not installed on this system. Please install Python 3.9+ and try again.",
    );
  }

  const requirementsPath = path.join(nativeDir, "requirements.txt");
  if (!fs.existsSync(requirementsPath)) {
    throw new Error(
      `JobSpy requirements.txt not found at ${requirementsPath}`,
    );
  }

  const venvDir = path.join(nativeDir, "venv");

  console.log("[JobSpy Setup] Creating venv with:", systemPython);
  execSync(`${systemPython} -m venv "${venvDir}"`, {
    cwd: nativeDir,
    timeout: 60_000,
    stdio: "pipe",
  });

  const pip =
    process.platform === "win32"
      ? path.join(venvDir, "Scripts", "pip")
      : path.join(venvDir, "bin", "pip");

  console.log("[JobSpy Setup] Installing requirements…");
  execSync(`"${pip}" install -r "${requirementsPath}"`, {
    cwd: nativeDir,
    timeout: 300_000, // 5 min – first install can be slow
    stdio: "pipe",
  });

  console.log("[JobSpy Setup] Done.");
}

export function runJobspySearch(options: JobspyOptions): Promise<any> {
  return new Promise((resolve, reject) => {
    const nativeDir = getJobspyDir();
    const venvBin = getVenvPython(nativeDir);
    const scriptPath = path.join(nativeDir, "scraper.py");

    // Auto-setup the venv if it doesn't exist yet
    if (!fs.existsSync(venvBin)) {
      console.log(
        "[JobSpy Runner] Venv not found, auto-provisioning…",
        nativeDir,
      );
      try {
        setupVenv(nativeDir);
      } catch (err: any) {
        return reject(
          new Error(
            `Failed to auto-setup JobSpy environment: ${err.message}`,
          ),
        );
      }
    }

    // Final check after potential auto-setup
    if (!fs.existsSync(venvBin)) {
      return reject(
        new Error(
          "JobSpy Python environment not found. Please run the setup script.",
        ),
      );
    }

    let command = `"${venvBin}" "${scriptPath}" --query "${options.query}" --location "${options.location}"`;
    if (options.sites) command += ` --sites "${options.sites}"`;
    if (options.results) command += ` --results ${options.results}`;
    if (options.hours) command += ` --hours ${options.hours}`;
    if (options.remote) command += ` --remote`;

    console.log("[JobSpy Runner] Executing:", command);

    // Increase maxBuffer to 50MB because JSON output can be large
    exec(
      command,
      { maxBuffer: 1024 * 1024 * 50, cwd: nativeDir },
      (error, stdout, stderr) => {
        if (error) {
          console.error("[JobSpy Runner] Error:", stderr || error.message);
          return reject(new Error(stderr || error.message));
        }
        try {
          const result = JSON.parse(stdout);
          if (!result.success) {
            return reject(new Error(result.error));
          }
          resolve(result.data);
        } catch (e) {
          console.error("[JobSpy Runner] Failed to parse JSON:", stdout);
          reject(new Error("Invalid output from JobSpy script"));
        }
      },
    );
  });
}
