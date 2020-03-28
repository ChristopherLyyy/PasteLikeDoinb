const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const robot = require('robotjs'); robot.setKeyboardDelay(20);
const HttpsProxyAgent = require('https-proxy-agent');
const https = require('https');
const url = require('url');
const io = require('socket.io-client');
const nanoid = require('nanoid');
const getWindowsRelease = require('windows-release');

var socket;
var socketServerAddress = '';
var clip = '';
var win = null;
var pcClientId = nanoid(4);
var gotProxy = false;

function prepareHttpsAgentAndCreateWindow() {
    let windowsRelease = getWindowsRelease();
    if (['10','8.1','8'].indexOf(windowsRelease) >= 0) {
        const getSystemProxyForUrl = require('get-system-proxy-for-url');
        getSystemProxyForUrl("https://www.google.com")
        .then(proxy => {
            if (proxy === 'DIRECT') {
                gotProxy = true;
                createLoadingPageWindow();
            }
            else if ((proxy !== undefined) && (proxy !== null)) {
                gotProxy = true;
                let proxyServerObj = url.parse(proxy);
                let href = proxyServerObj.href;
                https.globalAgent = new HttpsProxyAgent(href);
                createLoadingPageWindow();
            }
            else {
                createLoadingPageWindow();
            }
        })
    }
    else {
        createLoadingPageWindow();
    }
}

function createLoadingPageWindow() {
    Menu.setApplicationMenu(null);
    win = new BrowserWindow({
        width: 371,
        height: 600,
        webPreferences: { nodeIntegration: true }
    })
    win.on('closed', () => {
        win = null;
    })
    if (!gotProxy) {
        win.webContents.session.resolveProxy('https://www.google.com')
        .then(str => {
            let parts = str.split(' ');
            if (parts[0] === 'PROXY') {
                let resolvedProxyAddress = parts[1];
                let resolvedProxyhref = 'http://' + resolvedProxyAddress;
                https.globalAgent = new HttpsProxyAgent(resolvedProxyhref);
                win.webContents.loadFile('loading-page.html');
            }
            else {
                win.webContents.loadFile('loading-page.html');
            }
        })    
    }
    else {
        win.webContents.loadFile('loading-page.html');    
    }
}

function loadDoor() {
    win.loadFile('door.html');
}

function typeit() {
    robot.keyTap('capslock');
    robot.keyTap('enter');
    robot.typeStringDelayed(clip.toLowerCase(), 99999);
    robot.keyTap('enter');
    robot.keyTap('capslock');
}

app.on('ready', prepareHttpsAgentAndCreateWindow);
app.on('window-all-closed', () => {
    app.quit();
})

ipcMain.on('socketServerInfo', (event, arg) => {
    socketServerAddress = arg;
    let opts = {
        rejectUnauthorized: false,
        reconnection: true,
        agent: https.globalAgent
    };
    socket = io(socketServerAddress, opts);
    app.on('will-quit', () => {
        socket.close();
    })
    socket.on('connect', () => {
        win.webContents.send('loadStatus_SocketLinked');
    })
    socket.on('check', () => {
        socket.emit('ispc', pcClientId);
        win.webContents.send('loadStatus_PCIdEmitted')
    })
    socket.on('pcoc', () => {
        pcClientId = nanoid(4);
        socket.emit('ispc', pcClientId);
    })
    socket.on('pcintro', (msg) => {
        win.webContents.send('loadStatus_MobileLinkReceived')
        var correspMobileClientLink = socketServerAddress + '/m/' + msg;
        loadDoor();
        win.webContents.on('did-finish-load', () => {
            win.webContents.send('refer', correspMobileClientLink);
        })
    })
    socket.on('clips2p', (msg) => {
        clip = msg;
        typeit();
    })
})
