var {
    WebUSB
} = require('usb');
const {
    app,
    Tray,
    Menu,
    nativeImage
} = require('electron');
if (require('electron-squirrel-startup')) app.quit();
const path = require('path');
const rootPath = app.getAppPath();
let tray;
let batteryCheckInterval;

app.whenReady().then(() => {
    const icon = nativeImage.createFromPath(path.join(rootPath, 'src/assets/bat_5.png'));
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        {label: 'Quit', type: 'normal', click: QuitClick}
    ]);

    batteryCheckInterval = setInterval(() => {
        SetTrayDetails(tray);
    }, 30000);

    SetTrayDetails(tray);

    tray.setContextMenu(contextMenu);
    tray.setToolTip('?');
    tray.setTitle('Razer Battery Life');
})

function SetTrayDetails(tray) {
    GetBattery().then(battLife => {
        if (battLife === 0) return;

        let assetPath = GetBatteryIconPath(battLife);

        tray.setImage(nativeImage.createFromPath(path.join(rootPath, assetPath)));
        tray.setToolTip(battLife + '%');
    });
}

function GetBatteryIconPath(val) {
    let iconName;

    iconName = (Math.floor(val/5) * 5) + '.png';

    return `src/assets/${iconName}`;
}

function QuitClick() {
    clearInterval(batteryCheckInterval);
    if (process.platform !== 'darwin') app.quit();
}

// mouse stuff
const RazerVendorId = 0x1532;
const TransactionId = 0x1f
const RazerProducts = {
    0x00A5: {
        name: 'Razer Viper V2 Pro Wired',
        wireless: true
    },
    0x00A6: {
        name: 'Razer Viper V2 Pro Wireless',
        wireless: true
    }
};

function GetMessage() {
    // Function that creates and returns the message to be sent to the device
    let msg = Buffer.from([0x00, TransactionId, 0x00, 0x00, 0x00, 0x02, 0x07, 0x80]);
    let crc = 0;

    for (let i = 2; i < msg.length; i++) {
        crc = crc ^ msg[i];
    }

    // the next 80 bytes would be storing the data to be sent, but for getting the battery no data is sent
    msg = Buffer.concat([msg, Buffer.alloc(80)])

    // the last 2 bytes would be the crc and a zero byte
    msg = Buffer.concat([msg, Buffer.from([crc, 0])]);

    return msg;
}

async function GetMouse() {
    const customWebUSB = new WebUSB({
        // This function can return a promise which allows a UI to be displayed if required
        devicesFound: devices => devices.find(device => device.vendorId === RazerVendorId && RazerProducts[device.productId] !== undefined)
    });

    // Returns device based on injected 'devicesFound' function
    const device = await customWebUSB.requestDevice({
        filters: [{}]
    })

    if (device) {
        return device;
    } else {
        throw new Error('No Razer device found on system');
    }
}

async function GetBattery() {
    try {
        const mouse = await GetMouse();

        const msg = GetMessage();

        await mouse.open();

        if (mouse.configuration === null) {
            await mouse.selectConfiguration(1)
        }

        await mouse.claimInterface(mouse.configuration.interfaces[0].interfaceNumber);
        await mouse.controlTransferOut({
            requestType: 'class',
            recipient: 'interface',
            request: 0x09,
            value: 0x300,
            index: 0x00
        }, msg);
        await new Promise(res => setTimeout(res, 500));

        const reply = await mouse.controlTransferIn({
            requestType: 'class',
            recipient: 'interface',
            request: 0x01,
            value: 0x300,
            index: 0x00
        }, 90)

        return (reply.data.getUint8(9) / 255 * 100).toFixed();
    } catch (error) {
        console.error(error);
    }
}
