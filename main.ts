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
import isOnline from "is-online";
import Store from "electron-store";

// Window state store for persistence
interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

const store = new Store<{ windowState: WindowState }>({
  defaults: {
    windowState: {
      width: 992,
      height: 600,
      isMaximized: false,
    },
  },
});

let tray: Tray | null = null;
let mainWindow: BrowserWindow;
const URL = "https://monkeytype.com/";
const OFFLINE_URL = "offline.html";

// Get saved window state
function getWindowState(): WindowState {
  return store.get("windowState");
}

// Save current window state
function saveWindowState() {
  if (!mainWindow) return;

  const isMaximized = mainWindow.isMaximized();
  const bounds = mainWindow.getBounds();

  store.set("windowState", {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    isMaximized,
  });
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
app.whenReady().then(() => {
  createWindow();
  createTray();
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
