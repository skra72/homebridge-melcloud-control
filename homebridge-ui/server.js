"use strict";

const { HomebridgePluginUiServer, RequestError } = require('@homebridge/plugin-ui-utils');
const MelCloud = require('../src/melcloud.js')

class PluginUiServer extends HomebridgePluginUiServer {
  constructor() {
    super();

    //connect
    this.onRequest('/connect', this.start.bind(this));

    //this MUST be called when you are ready to accept requests
    this.ready();
  };

  async start(payload) {
    const accountName = payload.accountName;
    const user = payload.user;
    const passwd = payload.passwd;
    const language = payload.language;
    const accountFile = `${this.homebridgeStoragePath}/melcloud/${accountName}_Account`;
    const buildingsFile = `${this.homebridgeStoragePath}/melcloud/${accountName}_Buildings`;
    const devicesFile = `${this.homebridgeStoragePath}/melcloud/${accountName}_Devices`;
    const melCloud = new MelCloud(user, passwd, language, accountFile, buildingsFile, devicesFile, false, true);

    try {
      const response = await melCloud.connect();
      const accountInfo = response.accountInfo;
      const contextKey = response.contextKey;
      const devices = await melCloud.chackDevicesList(contextKey);
      return devices;
    } catch (error) {
      throw new Error(`MELCloud error: ${error.message ?? error}.`);
    };
  };
};

(() => {
  return new PluginUiServer();
})();
