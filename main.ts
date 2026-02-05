import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  nativeImage,
  session,
  globalShortcut,
} from "electron";
import path from "path";
import fs from "fs";
import isOnline from "is-online";

// Window state store for persistence
interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

const CONFIG_FILE = path.join(app.getPath("userData"), "window-state.json");

const defaultWindowState: WindowState = {
  width: 992,
  height: 600,
  isMaximized: false,
};

let tray: Tray | null = null;
let mainWindow: BrowserWindow;
const URL = "https://monkeytype.com/";
const OFFLINE_URL = "offline.html";

// Get saved window state
function getWindowState(): WindowState {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      return { ...defaultWindowState, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error("Failed to load window state:", e);
  }
  return defaultWindowState;
}

// Save current window state
function saveWindowState() {
  if (!mainWindow) return;

  const isMaximized = mainWindow.isMaximized();
  const bounds = mainWindow.getBounds();

  const state: WindowState = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    isMaximized,
  };

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error("Failed to save window state:", e);
  }
}

app.setName("MonkeyType Desktop");

app.setAboutPanelOptions({
  applicationName: "MonkeyType Desktop",
  applicationVersion: "1.0.0",
  copyright: "© 2025 Tachera Sasi",
  credits:
    "This is an unofficial wrapper around MonkeyType.\nMade with ❤️ using Electron by Tachera Sasi.",
  website: URL,
});

// Create the main browser window
async function createWindow() {
  const windowState = getWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: false,
    },
    icon: path.join(__dirname, "../assets/images/monkeytype.png"),
    frame: true,
    autoHideMenuBar: true,
    show: false,
  });

  // Restore maximized state
  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Save window state on resize, move, and close
  mainWindow.on("resize", saveWindowState);
  mainWindow.on("move", saveWindowState);
  mainWindow.on("close", saveWindowState);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  const online = await isOnline();

  if (online) {
    mainWindow.loadURL(URL);
  } else {
    mainWindow.loadFile(OFFLINE_URL);
  }
}

// Create the tray icon and menu
function createTray() {
  const trayIcon = nativeImage
    .createFromPath(path.join(__dirname, "../assets/images/monkeytype.png"))
    .resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  const contextMenu = Menu.buildFromTemplate([
    { label: "Show App", click: () => mainWindow.show() },
    { label: "Quit", click: () => app.quit() },
  ]);

  tray.setToolTip("MonkeyType Desktop");
  tray.setContextMenu(contextMenu);
}

// Register keyboard shortcuts
function registerShortcuts() {
  // Global shortcut to show/hide the app (Cmd/Ctrl + Shift + M)
  globalShortcut.register("CommandOrControl+Shift+M", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // In-app shortcuts using webContents
  mainWindow.webContents.on("before-input-event", (event, input) => {
    // Reload page: Cmd/Ctrl + R
    if (input.key === "r" && (input.meta || input.control) && !input.shift) {
      mainWindow.webContents.reload();
      event.preventDefault();
    }

    // Hard reload (clear cache): Cmd/Ctrl + Shift + R
    if (input.key === "R" && (input.meta || input.control) && input.shift) {
      mainWindow.webContents.reloadIgnoringCache();
      event.preventDefault();
    }

    // Toggle fullscreen: F11 or Cmd/Ctrl + Shift + F
    if (
      input.key === "F11" ||
      (input.key === "f" && (input.meta || input.control) && input.shift)
    ) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }

    // Zoom in: Cmd/Ctrl + Plus/=
    if (input.key === "=" && (input.meta || input.control)) {
      const currentZoom = mainWindow.webContents.getZoomLevel();
      mainWindow.webContents.setZoomLevel(currentZoom + 0.5);
      event.preventDefault();
    }

    // Zoom out: Cmd/Ctrl + Minus
    if (input.key === "-" && (input.meta || input.control)) {
      const currentZoom = mainWindow.webContents.getZoomLevel();
      mainWindow.webContents.setZoomLevel(currentZoom - 0.5);
      event.preventDefault();
    }

    // Reset zoom: Cmd/Ctrl + 0
    if (input.key === "0" && (input.meta || input.control)) {
      mainWindow.webContents.setZoomLevel(0);
      event.preventDefault();
    }

    // Developer tools: Cmd/Ctrl + Shift + I
    if (input.key === "i" && (input.meta || input.control) && input.shift) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
}

// Schedule a placeholder notification (can be removed/edited later)
function scheduleMorningNotification() {
  if (Notification.isSupported()) {
    new Notification({
      title: "MonkeyType App",
      body: "MonkeyType Desktop is running in the background.",
    }).show();
  }
}

// Electron lifecycle
app.whenReady().then(async () => {
  await createWindow();
  createTray();
  registerShortcuts();
  scheduleMorningNotification();

  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      if (permission === "notifications") {
        callback(true);
      } else {
        callback(false);
      }
    }
  );

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders["User-Agent"] =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36";
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Unregister all shortcuts when app is about to quit
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
