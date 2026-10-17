import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OPENCODE_V1_VERSION = "1.18.29";
const OPENCODE_V2_VERSION = "2.0.29";
const SERVER_START_TIMEOUT_MS = 30_000;
const PLUGIN_START_TIMEOUT_MS = 90_000;
const RETRY_INTERVAL_MS = 250;
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withTimeout(promise, milliseconds, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: options.shell ?? false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error([
        `${command} ${args.join(" ")} failed (${signal ?? `exit ${code}`})`,
        stdout,
        stderr,
      ].filter(Boolean).join("\n")));
    });
  });
}

function runPackageManager(command, args, options = {}) {
  if (process.platform !== "win32") {
    return run(command, args, options);
  }
  return run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command, ...args], options);
}

function opencodeBinary(workspace, packageName) {
  if (process.platform === "win32") {
    return path.join(workspace, "node_modules", ...packageName.split("/"), "bin", "opencode.exe");
  }
  return path.join(workspace, "node_modules", ".bin", "opencode");
}

async function startServer(binary, workspace, home) {
  await Promise.all([
    mkdir(path.join(home, "config"), { recursive: true }),
    mkdir(path.join(home, "data"), { recursive: true }),
    mkdir(path.join(home, "cache"), { recursive: true }),
  ]);

  const child = spawn(binary, ["serve", "--hostname", "127.0.0.1", "--port", "0"], {
    cwd: workspace,
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      XDG_CONFIG_HOME: path.join(home, "config"),
      XDG_DATA_HOME: path.join(home, "data"),
      XDG_CACHE_HOME: path.join(home, "cache"),
      OPENCODE_SERVER_PASSWORD: "smoke-test",
    },
    shell: false,
    windowsHide: true,
  });
  let output = "";
  let settled = false;

  const exit = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  const ready = new Promise((resolve, reject) => {
    const append = (chunk) => {
      output += chunk;
      const match = output.match(/server listening on (http:\/\/127\.0\.0\.1:\d+)/i);
      if (match && !settled) {
        settled = true;
        resolve(match[1]);
      }
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.once("exit", (code, signal) => {
      if (!settled) {
        settled = true;
        reject(new Error(`OpenCode stopped before becoming ready (${signal ?? `exit ${code}`})\n${output}`));
      }
    });
  });

  let url;
  try {
    url = await withTimeout(
      ready,
      SERVER_START_TIMEOUT_MS,
      `OpenCode did not start within ${SERVER_START_TIMEOUT_MS}ms\n${output}`,
    );
  } catch (error) {
    child.kill("SIGKILL");
    throw error;
  }

  return {
    url,
    output: () => output,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }
      child.kill("SIGTERM");
      try {
        await withTimeout(exit, 5_000, "OpenCode did not stop after SIGTERM");
      } catch {
        child.kill("SIGKILL");
        await exit;
      }
    },
  };
}

async function waitForJson(url, predicate) {
  const authorization = `Basic ${Buffer.from("opencode:smoke-test").toString("base64")}`;
  const deadline = Date.now() + PLUGIN_START_TIMEOUT_MS;
  let lastResult = "No response received";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { headers: { authorization } });
      const text = await response.text();
      lastResult = `${response.status} ${text}`;
      if (response.ok) {
        const value = JSON.parse(text);
        if (predicate(value)) {
          return value;
        }
      }
    } catch (error) {
      lastResult = error instanceof Error ? error.message : String(error);
    }
    await delay(RETRY_INTERVAL_MS);
  }

  throw new Error(`Expected OpenCode response was not observed within ${PLUGIN_START_TIMEOUT_MS}ms: ${lastResult}`);
}

async function installEnvironment(directory, tarball, runtime) {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "package.json"), `${JSON.stringify({ private: true }, null, 2)}\n`);
  await runPackageManager(NPM, [
    "install",
    "--ignore-scripts=false",
    "--no-audit",
    "--no-fund",
    "--save-exact",
    tarball,
    runtime,
  ], { cwd: directory });

  const unexpectedRuntime = path.join(directory, "node_modules", "@opencode", "plugin");
  if (existsSync(unexpectedRuntime)) {
    throw new Error(`The packed plugin installed @opencode/plugin in ${directory}`);
  }
}

async function assertVersion(binary, version) {
  const result = await run(binary, ["--version"]);
  const output = `${result.stdout}\n${result.stderr}`.trim();
  if (!output.includes(version)) {
    throw new Error(`Expected OpenCode ${version}, received: ${output}`);
  }
}

async function smokeV1(root, tarball) {
  const workspace = path.join(root, "v1");
  console.log(`Installing OpenCode ${OPENCODE_V1_VERSION}...`);
  await installEnvironment(workspace, tarball, `opencode-ai@${OPENCODE_V1_VERSION}`);
  await writeFile(path.join(workspace, "opencode.jsonc"), `${JSON.stringify({
    $schema: "https://opencode.ai/config.json",
    plugin: ["./node_modules/@jfrz38/opencode-copy-last"],
  }, null, 2)}\n`);

  const binary = opencodeBinary(workspace, "opencode-ai");
  await assertVersion(binary, OPENCODE_V1_VERSION);
  const server = await startServer(binary, workspace, path.join(root, "v1-home"));
  try {
    await waitForJson(`${server.url}/config`, (config) =>
      config?.command?.["copy-last"]?.template === "/copy-last [agent|user|pair] [count|all]");
    console.log(`✓ OpenCode ${OPENCODE_V1_VERSION} loaded the packed plugin`);
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${server.output()}`);
  } finally {
    await server.stop();
  }
}

async function smokeV2(root, tarball) {
  const workspace = path.join(root, "v2");
  console.log(`Installing OpenCode ${OPENCODE_V2_VERSION}...`);
  await installEnvironment(workspace, tarball, `@opencode/cli@${OPENCODE_V2_VERSION}`);
  const pluginDirectory = path.join(
    workspace,
    "node_modules",
    "@jfrz38",
    "opencode-copy-last",
  );
  await writeFile(path.join(pluginDirectory, "opencode.jsonc"), `${JSON.stringify({
    $schema: "https://opencode.ai/config.json",
    plugins: ["."],
  }, null, 2)}\n`);

  const binary = opencodeBinary(workspace, "@opencode/cli");
  await assertVersion(binary, OPENCODE_V2_VERSION);
  const server = await startServer(binary, pluginDirectory, path.join(root, "v2-home"));
  try {
    await waitForJson(`${server.url}/api/plugin`, (response) => response?.data?.some((plugin) =>
      plugin.id === "copy-last"
      && plugin.state?.status === "active"
      && plugin.features?.server === true
      && plugin.features?.rpc === true
      && plugin.features?.tui === true));
    await waitForJson(`${server.url}/api/command`, (response) => response?.data?.some((command) =>
      command.name === "copy-last"));
    console.log(`✓ OpenCode ${OPENCODE_V2_VERSION} loaded the packed plugin`);
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${server.output()}`);
  } finally {
    await server.stop();
  }
}

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), "opencode-copy-last-smoke-"));
  try {
    const packDirectory = path.join(root, "pack");
    await mkdir(packDirectory, { recursive: true });
    console.log("Packing the plugin...");
    await runPackageManager(PNPM, ["pack", "--pack-destination", packDirectory], { cwd: ROOT });
    const tarballs = (await readdir(packDirectory)).filter((entry) => entry.endsWith(".tgz"));
    if (tarballs.length !== 1) {
      throw new Error(`Expected one package tarball, found ${tarballs.length}`);
    }
    const tarball = path.join(packDirectory, tarballs[0]);
    const packedManifest = JSON.parse(await readFile(
      path.join(ROOT, "package.json"),
      "utf8",
    ));
    if (packedManifest.dependencies?.["@opencode/plugin"]) {
      throw new Error("@opencode/plugin remains a production dependency");
    }

    await smokeV1(root, tarball);
    await smokeV2(root, tarball);
    console.log("✓ OpenCode compatibility smoke test passed");
  } finally {
    if (process.env.KEEP_OPENCODE_SMOKE_TEMP === "1") {
      console.log(`Preserving smoke test files in ${root}`);
    } else {
      await rm(root, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
