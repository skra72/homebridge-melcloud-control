'use strict';

const fs = require('fs');
const path = require('path');
const mqttClient = require('./src/mqtt.js');
const melCloud = require('./src/melcloud.js')
const melCloudDevice = require('./src/melclouddevice.js')

const API_URL = require('./src/apiurl.json');
const DEVICES_EFFECTIVE_FLAGS = require('./src/effectiveflags.json');
const CONSTANS = require('./src/constans.json');

const PLUGIN_NAME = 'homebridge-melcloud-control';
const PLATFORM_NAME = 'melcloudcontrol';

let Accessory, Characteristic, Service, Categories, AccessoryUUID;

module.exports = (api) => {
	Accessory = api.platformAccessory;
	Characteristic = api.hap.Characteristic;
	Service = api.hap.Service;
	Categories = api.hap.Categories;
	AccessoryUUID = api.hap.uuid;
	api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, melCloudPlatform, true);
};

class melCloudPlatform {
	constructor(log, config, api) {
		// only load if configured
		if (!config || !Array.isArray(config.accounts)) {
			log('No configuration found for %s', PLUGIN_NAME);
			return;
		}
		this.log = log;
		this.api = api;
		const accounts = config.accounts;
		const accountsCount = accounts.length;
		this.accessories = [];

		this.api.on('didFinishLaunching', () => {
			this.log.debug('didFinishLaunching');
			for (let i = 0; i < accountsCount; i++) {
				const account = accounts[i];
				const accountName = account.name;
				const user = account.user;
				const passwd = account.passwd;
				const language = account.language;
				if (!accountName || !user || !passwd || !language) {
					this.log('Name, user, password or language for %s accout missing.', i);
					return;
				} else {
					const enableDebugMode = account.enableDebugMode;
					const prefDir = path.join(api.user.storagePath(), 'melcloud');
					const melCloudInfoFile = `${prefDir}/${accountName}_Account`;
					const melCloudBuildingsFile = `${prefDir}/${accountName}_Buildings`;

					//check if the directory exists, if not then create it
					if (fs.existsSync(prefDir) == false) {
						fs.mkdirSync(prefDir);
					};
					if (fs.existsSync(melCloudInfoFile) == false) {
						fs.writeFileSync(melCloudInfoFile, '');
					};
					if (fs.existsSync(melCloudBuildingsFile) == false) {
						fs.writeFileSync(melCloudBuildingsFile, '');
					};

					//melcloud login
					this.melCloud = new melCloud({
						name: accountName,
						user: user,
						passwd: passwd,
						language: language,
						debugLog: enableDebugMode,
						melCloudInfoFile: melCloudInfoFile,
						melCloudBuildingsFile: melCloudBuildingsFile
					});

					this.melCloud.on('connected', (melCloudInfo, contextKey, devices, devicesCount) => {
							if (devicesCount > 0) {
								for (let i = 0; i < devicesCount; i++) {
									const device = devices[i];
									const buildingId = device.BuildingID;
									const deviceId = device.DeviceID;
									const deviceName = device.DeviceName;
									const deviceType = device.Type;
									const deviceTypeText = CONSTANS.DeviceType[deviceType];

									new melCloudAccessory(this.log, this.api, account, contextKey, melCloudInfo, device, buildingId, deviceId, deviceName, deviceType, deviceTypeText);
								};
							} else {
								this.log(`Account: ${accountName}, No devices found!!!`)
							};
						})
						.on('message', (message) => {
							this.log(message);
						})
						.on('error', (error) => {
							this.log(error);
						})
						.on('debug', (message) => {
							this.log(message);
						});
				};
			};
		});
	};

	configureAccessory(accessory) {
		this.log.debug('configureAccessory');
		this.accessories.push(accessory);
	};

	removeAccessory(accessory) {
		this.log.debug('removeAccessory');
		this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
	};
};


class melCloudAccessory {
	constructor(log, api, account, contextKey, melCloudInfo, device, buildingId, deviceId, deviceName, deviceType, deviceTypeText) {
		this.log = log;
		this.api = api;

		this.accountName = account.name;
		this.displayMode = account.displayMode;
		this.buttons = account.buttons || [];
		this.buttonsCount = this.buttons.length;
		this.disableLogInfo = account.disableLogInfo || false;
		this.disableLogDeviceInfo = account.disableLogDeviceInfo || false;
		this.enableDebugMode = account.enableDebugMode || false;

		const enableMqtt = account.enableMqtt || false;
		const mqttHost = account.mqttHost;
		const mqttPort = account.mqttPort || 1883;
		const mqttPrefix = account.mqttPrefix;
		const mqttAuth = account.mqttAuth || false;
		const mqttUser = account.mqttUser;
		const mqttPasswd = account.mqttPass;
		const mqttDebug = account.mqttDebug || false;

		this.contextKey = contextKey;
		this.device = device;
		this.buildingId = buildingId;
		this.deviceId = deviceId;
		this.deviceName = deviceName;
		this.deviceType = deviceType;
		this.deviceTypeText = deviceTypeText;
		this.startPrepareAccessory = true;
		this.displayDeviceInfo = true;

		//mqtt client
		if (enableMqtt) {
			this.mqttClient = new mqttClient({
				enabled: enableMqtt,
				host: mqttHost,
				port: mqttPort,
				prefix: mqttPrefix,
				topic: this.accountName,
				auth: mqttAuth,
				user: mqttUser,
				passwd: mqttPasswd,
				debug: mqttDebug
			});

			this.mqttClient.on('connected', (message) => {
					this.log(message);
				})
				.on('error', (error) => {
					this.log(error);
				})
				.on('debug', (message) => {
					this.log(message);
				})
				.on('message', (message) => {
					this.log(message);
				})
				.on('disconnected', (message) => {
					this.log(message);
				});
		};

		//melcloud device
		this.melCloudDevice = new melCloudDevice({
			device: this.device,
			contextKey: this.contextKey,
			buildingId: this.buildingId,
			deviceId: this.deviceId,
			debugLog: this.enableDebugMode,
			mqttEnabled: enableMqtt,
			melCloudInfo: melCloudInfo
		});

		this.melCloudDevice.on('deviceInfo', (manufacturer, modelName, modelName1, serialNumber, firmwareRevision) => {
				if (!this.disableLogDeviceInfo && this.displayDeviceInfo) {
					this.log('------- %s --------', this.deviceTypeText);
					this.log('Account: %s', this.accountName);
					this.log('Name: %s', this.deviceName);
					this.log('Model: %s', modelName);
					this.log('Serial: %s', serialNumber);
					this.log('Firmware: %s', firmwareRevision);
					const device1 = (modelName1 != undefined && deviceType == 0) ? this.log('Outdoor: %s', modelName1) : false;
					this.log('Manufacturer: %s', manufacturer);
					this.log('----------------------------------');
					this.displayDeviceInfo = false;
				};
				this.manufacturer = manufacturer;
				this.modelName = modelName;
				this.serialNumber = serialNumber;
				this.firmwareRevision = firmwareRevision;
			})
			.on('deviceState', (melCloudInfo, useFahrenheit, deviceState, power, inStandbyMode, operationMode, roomTemperature, setTemperature, setFanSpeed, numberOfFanSpeeds, vaneHorizontal, vaneVertical, lockPhysicalControls) => {
				this.deviceState = deviceState;
				this.melCloudInfo = melCloudInfo;
				this.temperatureDisplayUnitValue = useFahrenheit;
				this.temperatureDisplayUnitString = CONSTANS.TemperatureDisplayUnits[this.temperatureDisplayUnitValue]
				this.lockPhysicalControls = lockPhysicalControls;

				const displayMode = this.displayMode;
				//INACTIVE, IDLE, HEATING, COOLING
				const valueHeaterCooler = power ? inStandbyMode ? 1 : [1, 2, 2, 3, 3, 3, 3, 3, 3][operationMode] : 0;
				//OFF, HEAT, COOL
				const valueThermostat = power ? inStandbyMode ? 0 : [0, 1, 2, 2, 2, 2, 2, 2, 2][operationMode] : 0;
				const currentMode = displayMode ? valueThermostat : valueHeaterCooler;
				this.currentModesHeaterCoolerThermostat = currentMode;

				//AUTO/ HEAT, COOL
				const valueTargetHeaterCooler = power ? inStandbyMode ? 0 : [0, 1, 1, 2, 2, 2, 2, 2, 0][operationMode] : 0;
				//OFF, HEAT, COOL, AUTO
				const valueTargetThermostat = power ? inStandbyMode ? 0 : [0, 1, 2, 2, 2, 2, 2, 2, 3][operationMode] : 0;
				const targetMode = displayMode ? valueTargetThermostat : valueTargetHeaterCooler;
				this.targetModesHeaterCoolerThermostat = targetMode;

				const roomTemperatureFahrenheitCelsius = (useFahrenheit == 0) ? (roomTemperature - 32) * 5 / 9 : roomTemperature * 9 / 5 + 32;
				const setTemperatureFahrenheitCelsius = (useFahrenheit == 0) ? (setTemperature - 32) * 5 / 9 : setTemperature * 9 / 5 + 32;
				this.roomTemperatureFahrenheitCelsius = roomTemperatureFahrenheitCelsius;
				this.setTemperatureFahrenheitCelsius = setTemperatureFahrenheitCelsius;

				const fanSpeed = [6, 1, 2, 3, 4, 5][setFanSpeed]
				this.fanSpeed = fanSpeed;

				const swingMode = (vaneHorizontal == 12 && vaneVertical == 7) ? 1 : 0;
				this.swingMode = swingMode;

				if (this.melCloudService) {
					if (displayMode == 0) {
						this.melCloudService
							.updateCharacteristic(Characteristic.Active, power)
							.updateCharacteristic(Characteristic.CurrentHeaterCoolerState, currentMode)
							.updateCharacteristic(Characteristic.TargetHeaterCoolerState, targetMode)
							.updateCharacteristic(Characteristic.CurrentTemperature, roomTemperature)
							.updateCharacteristic(Characteristic.RotationSpeed, fanSpeed)
							.updateCharacteristic(Characteristic.SwingMode, swingMode)
							.updateCharacteristic(Characteristic.CoolingThresholdTemperature, setTemperature)
							.updateCharacteristic(Characteristic.HeatingThresholdTemperature, setTemperature)
							.updateCharacteristic(Characteristic.CurrentHorizontalTiltAngle, vaneHorizontal)
							.updateCharacteristic(Characteristic.TargetHorizontalTiltAngle, vaneHorizontal)
							.updateCharacteristic(Characteristic.CurrentVerticalTiltAngle, vaneVertical)
							.updateCharacteristic(Characteristic.TargetVerticalTiltAngle, vaneVertical)
							.updateCharacteristic(Characteristic.TemperatureDisplayUnits, useFahrenheit)
							.updateCharacteristic(Characteristic.LockPhysicalControls, lockPhysicalControls)
					};
					if (displayMode == 1) {
						this.melCloudService
							.updateCharacteristic(Characteristic.CurrentHeatingCoolingState, currentMode)
							.updateCharacteristic(Characteristic.TargetHeatingCoolingState, targetMode)
							.updateCharacteristic(Characteristic.CurrentTemperature, roomTemperature)
							.updateCharacteristic(Characteristic.TargetTemperature, setTemperature)
							.updateCharacteristic(Characteristic.CoolingThresholdTemperature, setTemperature)
							.updateCharacteristic(Characteristic.HeatingThresholdTemperature, setTemperature)
							.updateCharacteristic(Characteristic.TemperatureDisplayUnits, useFahrenheit)
					};
				};

				this.buttonsStates = new Array();
				const buttonsCount = this.buttonsCount;
				if (buttonsCount > 0) {
					const buttons = this.buttons;
					for (let i = 0; i < buttonsCount; i++) {
						const button = buttons[i];
						const buttonMode = button.mode;
						let buttonState = false;
						switch (buttonMode) {
							case 0: //ON,OFF
								buttonState = (power == true);
								break;
							case 1: //HEAT
								buttonState = power ? (buttonMode == operationMode) : false;
								break;
							case 2: //DRY
								buttonState = power ? (buttonMode == operationMode) : false;
								break
							case 3: //COOL
								buttonState = power ? (buttonMode == operationMode) : false;
								break;
							case 7: //FAN
								buttonState = power ? (buttonMode == operationMode) : false;
								break;
							case 8: //AUTO
								buttonState = power ? (buttonMode == operationMode) : false;
								break;
							case 9: //PURIFY
								buttonState = power ? (buttonMode == operationMode) : false;
								break;
							case 10: //PHYSICAL LOCK CONTROLS
								buttonState = (lockPhysicalControls == 1);
								break;
						}
						this.buttonsStates.push(buttonState);
						if (this.buttonsServices) {
							this.buttonsServices[i]
								.updateCharacteristic(Characteristic.On, buttonState)
						};
					};
				};

				const mqtt = enableMqtt ? this.mqttClient.send('MELCloud Info:', this.melCloudInfo) : false;
				const mqtt1 = enableMqtt ? this.mqttClient.send('Device Info:', this.device) : false;
				const mqtt2 = enableMqtt ? this.mqttClient.send('Device State:', this.deviceState) : false;
				if (this.startPrepareAccessory) {
					this.prepareAccessory();
				};
			})
			.on('error', (error) => {
				this.log(error);
			})
			.on('debug', (message) => {
				this.log(message);
			})
			.on('message', (message) => {
				this.log(message);
			})
			.on('mqtt', (topic, message) => {
				this.mqttClient.send(topic, message);
			});
	};

	//prepare accessory
	async prepareAccessory() {
		this.log.debug('prepareAccessory');
		const melCloudInfo = this.melCloudInfo;
		const deviceState = this.deviceState;
		const deviceName = this.deviceName;
		const deviceType = this.deviceType;
		const deviceTypeText = this.deviceTypeText;
		const temperatureUnit = this.temperatureDisplayUnitString;
		const deviceTypeUrl = [API_URL.SetAta, API_URL.SetAtw, '', API_URL.SetErv][deviceType];

		const manufacturer = this.manufacturer;
		const modelName = this.modelName;
		const serialNumber = this.serialNumber;
		const firmwareRevision = this.firmwareRevision;

		const displayMode = this.displayMode;
		const currentModeText = CONSTANS.AirConditioner.CurrentHeaterCoolerThermostat[displayMode];
		const targetModeText = CONSTANS.AirConditioner.TargetHeaterCoolerThermostat[displayMode];

		//accessory
		const accessoryName = deviceName;
		const accessoryUUID = AccessoryUUID.generate(this.deviceId.toString());
		const accessoryCategory = displayMode ? Categories.THERMOSTAT : Categories.AIR_CONDITIONER;
		const accessory = new Accessory(accessoryName, accessoryUUID, accessoryCategory);

		//information service
		this.log.debug('prepareInformationService');
		accessory.removeService(accessory.getService(Service.AccessoryInformation));
		const informationService = new Service.AccessoryInformation(accessoryName);
		informationService
			.setCharacteristic(Characteristic.Manufacturer, manufacturer)
			.setCharacteristic(Characteristic.Model, modelName)
			.setCharacteristic(Characteristic.SerialNumber, serialNumber)
			.setCharacteristic(Characteristic.FirmwareRevision, firmwareRevision);
		accessory.addService(informationService);


		//melcloud service
		this.log.debug('prepareMelCloudService');
		this.melCloudService = displayMode ? new Service.Thermostat(accessoryName, 'Thermostat') : new Service.HeaterCooler(accessoryName, 'HeaterCooler');
		if (displayMode == 0) {
			//Only for Heater Cooler Service
			this.melCloudService.getCharacteristic(Characteristic.Active)
				.onGet(async () => {
					const state = deviceState.Power;
					const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Power state: ${state?'ON':'OFF'}`);
					return state;
				})
				.onSet(async (state) => {
					deviceState.Power = state;
					deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.Power;

					try {
						const newState = await this.melCloudDevice.send(deviceTypeUrl, deviceState, 0);
						const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Set power state: ${state?'ON':'OFF'}`);
					} catch (error) {
						this.log.error(`${deviceTypeText}: ${accessoryName}, Set power state error: ${error}`);
					};
				});
			this.melCloudService.getCharacteristic(Characteristic.RotationSpeed)
				.setProps({
					minValue: 0,
					maxValue: 6,
					minStep: 1
				})
				.onGet(async () => {
					//AUTO, 1, 2, 3, 4, 5
					const value = this.fanSpeed;
					const fansSpeedMode = [0, 1, 2, 3, 4, 5, 6][value];
					const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Fan speed: ${CONSTANS.AirConditioner.SetFanSpeed[fansSpeedMode]}`);
					return value;
				})
				.onSet(async (value) => {
					value = [0, 1, 2, 3, 4, 5, 6][value];
					const fansSpeedMode = [0, 1, 2, 3, 4, 5, 6][value];
					deviceState.SetFanSpeed = value;
					deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.SetFanSpeed;

					try {
						const newState = await this.melCloudDevice.send(deviceTypeUrl, deviceState, 0);
						const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Set fan speed: ${CONSTANS.AirConditioner.SetFanSpeed[fansSpeedMode]}`);
					} catch (error) {
						this.log.error(`${deviceTypeText}: ${accessoryName}, Set fan speed error: ${error}`);
					};
				});
			this.melCloudService.getCharacteristic(Characteristic.SwingMode)
				.onGet(async () => {
					//Vane Horizontal: Auto, 1, 2, 3, 4, 5, 12 = Swing
					//Vane Vertical: Auto, 1, 2, 3, 4, 5, 7 = Swing
					const value = this.swingMode;
					const swingMode = value ? 6 : 0;
					const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Swing mode: ${CONSTANS.AirConditioner.SwingMode[swingMode]}`);
					return value;
				})
				.onSet(async (value) => {
					deviceState.VaneHorizontal = value ? 12 : 0;
					deviceState.VaneVertical = value ? 7 : 0;
					const swingMode = value ? 6 : 1;
					deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.VaneHorizontal + DEVICES_EFFECTIVE_FLAGS.AirConditioner.VaneVertical;

					try {
						const newState = await this.melCloudDevice.send(deviceTypeUrl, deviceState, 0);
						const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Set swing mode: ${CONSTANS.AirConditioner.SwingMode[swingMode]}`);
					} catch (error) {
						this.log.error(`${deviceTypeText}: ${accessoryName}, Set new swing mode error: ${error}`);
					};
				});
			this.melCloudService.getCharacteristic(Characteristic.CurrentHorizontalTiltAngle)
				.onGet(async () => {
					const value = deviceState.VaneHorizontal;
					const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Horizontal tilt angle: ${value}°`);
					return value;
				})
			this.melCloudService.getCharacteristic(Characteristic.TargetHorizontalTiltAngle)
				.onGet(async () => {
					const value = deviceState.VaneHorizontal;
					const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Target horizontal tilt angle: ${value}°`);
					return value;
				})
				.onSet(async (value) => {
					const tiltAngeleHorizontal = ((value + 90.0) / 45.0 + 1.0).toFixed(0);
					deviceState.VaneHorizontal = tiltAngeleHorizontal;
					deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.VaneHorizontal;

					try {
						const newState = await this.melCloudDevice.send(deviceTypeUrl, deviceState, 0);
						const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Set target horizontal tilt angle: ${value}°`);
					} catch (error) {
						this.log.error(`${deviceTypeText}: ${accessoryName}, Set target horizontal tilt angle error: ${error}`);
					};
				});
			this.melCloudService.getCharacteristic(Characteristic.CurrentVerticalTiltAngle)
				.onGet(async () => {
					const value = deviceState.VaneVertical;
					const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Vertical tilt angle: ${value}°`);
					return value;
				})
			this.melCloudService.getCharacteristic(Characteristic.TargetVerticalTiltAngle)
				.onGet(async () => {
					const value = deviceState.VaneVertical;
					const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Target vertical tilt angle: ${value}°`);
					return value;
				})
				.onSet(async (value) => {
					const tiltAngeleVertical = ((value + 90.0) / 45.0 + 1.0).toFixed(0);
					deviceState.VaneVertical = tiltAngeleVertical;
					deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.VaneVertical;

					try {
						const newState = await this.melCloudDevice.send(deviceTypeUrl, deviceState, 0);
						const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Set target vertical tilt angle: ${value}°`);
					} catch (error) {
						this.log.error(`${deviceTypeText}: ${accessoryName}, Set target vertical tilt angle error: ${error}`);
					};
				});
			this.melCloudService.getCharacteristic(Characteristic.LockPhysicalControls)
				.onGet(async () => {
					const value = this.lockPhysicalControls;
					const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Lock physical controls: ${value ? 'LOCKED':'UNLOCKED'}`);
					return value;
				})
				.onSet(async (value) => {
					value = value ? true : false;
					deviceState.ProhibitSetTemperature = value;
					deviceState.ProhibitOperationMode = value;
					deviceState.ProhibitPower = value;

					try {
						const newState = await this.melCloudDevice.send(deviceTypeUrl, deviceState, 0);
						const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Set locl physical controls: ${value ? 'LOCK':'UNLOCK'}`);
					} catch (error) {
						this.log.error(`${deviceTypeText}: ${accessoryName}, Set lock physical controls error: ${error}`);
					};
				});
		};
		this.melCloudService.getCharacteristic(displayMode ? Characteristic.CurrentHeatingCoolingState : Characteristic.CurrentHeaterCoolerState)
			.onGet(async () => {
				//1 = HEAT, 2 = DRY 3 = COOL, 7 = FAN, 8 = AUTO
				const currentMode = this.currentModesHeaterCoolerThermostat;
				const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Heating cooling mode: ${currentModeText[currentMode]}`);
				return currentMode;
			});
		this.melCloudService.getCharacteristic(displayMode ? Characteristic.TargetHeatingCoolingState : Characteristic.TargetHeaterCoolerState)
			.onGet(async () => {
				//1 = HEAT, 2 = DRY 3 = COOL, 7 = FAN, 8 = AUTO
				const targetMode = this.targetModesHeaterCoolerThermostat;
				const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Target heating cooling mode: ${targetModeText[targetMode]}`);
				return targetMode;
			})
			.onSet(async (value) => {
				switch (value) {
					case 0: //OFF, AUTO
						deviceState.Power = displayMode ? false : true;
						deviceState.OperationMode = displayMode ? deviceState.OperationMode : 8;
						deviceState.EffectiveFlags = displayMode ? DEVICES_EFFECTIVE_FLAGS.AirConditioner.Power : DEVICES_EFFECTIVE_FLAGS.AirConditioner.Power + DEVICES_EFFECTIVE_FLAGS.AirConditioner.OperationMode;
						break;
					case 1: //HEAT
						deviceState.Power = true;
						deviceState.OperationMode = 1;
						deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.Power + DEVICES_EFFECTIVE_FLAGS.AirConditioner.OperationMode;
						break;
					case 2: //COOL
						deviceState.Power = true;
						deviceState.OperationMode = 3;
						deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.Power + DEVICES_EFFECTIVE_FLAGS.AirConditioner.OperationMode;
						break;
					case 3: //AUTO only Thermostat
						deviceState.Power = true;
						deviceState.OperationMode = 8;
						deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.Power + DEVICES_EFFECTIVE_FLAGS.AirConditioner.OperationMode;
						break;
				};

				try {
					const newState = await this.melCloudDevice.send(deviceTypeUrl, deviceState, 0);
					const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Set target heating cooling mode: ${targetModeText[value]}`);
				} catch (error) {
					this.log.error(`${deviceTypeText}: ${accessoryName}, Set target heating cooling mode error: ${error}`);
				};
			});
		this.melCloudService.getCharacteristic(Characteristic.CurrentTemperature)
			.setProps({
				minValue: this.temperatureDisplayUnitValue ? 32 : 0,
				maxValue: this.temperatureDisplayUnitValue ? 212 : 100,
				minStep: this.temperatureDisplayUnitValue ? 1 : 0.5
			})
			.onGet(async () => {
				const value = deviceState.RoomTemperature;
				const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Temperature: ${value}${temperatureUnit}`);
				return value;
			});
		if (displayMode == 1) {
			//Only for Thermostat Service
			this.melCloudService.getCharacteristic(Characteristic.TargetTemperature)
				.setProps({
					minValue: this.temperatureDisplayUnitValue ? 50 : 10,
					maxValue: this.temperatureDisplayUnitValue ? 88 : 31,
					minStep: this.temperatureDisplayUnitValue ? 1 : 0.5
				})
				.onGet(async () => {
					const value = deviceState.SetTemperature;
					const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Target temperature: ${value}${temperatureUnit}`);
					return value;
				})
				.onSet(async (value) => {
					deviceState.SetTemperature = value;
					deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.SetTemperature;

					try {
						const newState = await this.melCloudDevice.send(deviceTypeUrl, deviceState, 0);
						const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Set target temperature: ${value}${temperatureUnit}`);
					} catch (error) {
						this.log.error(`${deviceTypeText}: ${accessoryName}, Set target temperature error: ${error}`);
					};
				});
		};
		this.melCloudService.getCharacteristic(Characteristic.CoolingThresholdTemperature)
			.setProps({
				minValue: this.temperatureDisplayUnitValue ? 61 : 10,
				maxValue: this.temperatureDisplayUnitValue ? 88 : 31,
				minStep: this.temperatureDisplayUnitValue ? 1 : 0.5
			})
			.onGet(async () => {
				const value = deviceState.SetTemperature;
				const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Cooling threshold temperature: ${value}${temperatureUnit}`);
				return value;
			})
			.onSet(async (value) => {
				deviceState.SetTemperature = value;
				deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.SetTemperature;

				try {
					const newState = await this.melCloudDevice.send(deviceTypeUrl, deviceState, 0);
					const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Set cooling threshold temperature: ${value}${temperatureUnit}`);
				} catch (error) {
					this.log.error(`${deviceTypeText}: ${accessoryName}, Set cooling threshold temperature error: ${error}`);
				};
			});
		this.melCloudService.getCharacteristic(Characteristic.HeatingThresholdTemperature)
			.setProps({
				minValue: this.temperatureDisplayUnitValue ? 50 : 10,
				maxValue: this.temperatureDisplayUnitValue ? 88 : 31,
				minStep: this.temperatureDisplayUnitValue ? 1 : 0.5
			})
			.onGet(async () => {
				const value = deviceState.SetTemperature;
				const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Heating threshold temperature: ${value}${temperatureUnit}`);
				return value;
			})
			.onSet(async (value) => {
				deviceState.SetTemperature = value;
				deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.SetTemperature;

				try {
					const newState = await this.melCloudDevice.send(deviceTypeUrl, deviceState, 0);
					const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Set heating threshold temperature: ${value}${temperatureUnit}`);
				} catch (error) {
					this.log.error(`${deviceTypeText}: ${accessoryName}, Set heating threshold temperature error: ${error}`);
				};
			});
		this.melCloudService.getCharacteristic(Characteristic.TemperatureDisplayUnits)
			.onGet(async () => {
				const value = this.temperatureDisplayUnitValue;
				const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Temperature display unit: ${temperatureUnit}`);
				return value;
			})
			.onSet(async (value) => {
				melCloudInfo.UseFahrenheit = value ? true : false;
				melCloudInfo.EmailOnCommsError = false;
				melCloudInfo.EmailOnUnitError = false;
				melCloudInfo.EmailCommsErrors = 1;
				melCloudInfo.EmailUnitErrors = 1;
				melCloudInfo.RestorePages = false;
				melCloudInfo.MarketingCommunication = false;
				melCloudInfo.AlternateEmailAddress = '';
				melCloudInfo.Fred = 4;

				try {
					//const newState = await this.melCloudDevice.send(API_URL.UpdateApplicationOptions, melCloudInfo, 1);
					const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Set temperature display unit: ${CONSTANS.TemperatureDisplayUnits[value]}`);
				} catch (error) {
					this.log.error(`${deviceTypeText}: ${accessoryName}, Set temperature display unit error: ${error}`);
				};
			});
		accessory.addService(this.melCloudService);

		//buttons services
		const buttonsCount = this.buttonsCount;
		if (buttonsCount > 0) {
			this.log.debug('prepareButtonsService');
			this.buttonsServices = new Array();
			const buttons = this.buttons;
			for (let i = 0; i < buttonsCount; i++) {
				//get button
				const button = buttons[i];

				//get button mode
				const buttonMode = button.mode;

				//get button name
				const buttonName = (button.name != undefined) ? button.name : buttonMode;

				//get button display type
				const buttonDisplayType = (button.displayType != undefined) ? button.displayType : 0;

				const buttonServiceType = [Service.Outlet, Service.Switch][buttonDisplayType];
				const buttonServiceName = accessoryName + ' ' + buttonName;
				const buttonService = new buttonServiceType(buttonServiceName, `ButtonService${i}`);
				buttonService.getCharacteristic(Characteristic.On)
					.onGet(async () => {
						const state = this.buttonsStates[i];
						return state;
					})
					.onSet(async (state) => {
						switch (buttonMode) {
							case 0: //ON,OFF
								deviceState.Power = state;
								deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.Power;
								break;
							case 1: //HEAT
								deviceState.Power = true;
								deviceState.OperationMode = 1;
								deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.Power + DEVICES_EFFECTIVE_FLAGS.AirConditioner.OperationMode;
								break;
							case 2: //DRY
								deviceState.Power = true;
								deviceState.OperationMode = 2;
								deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.Power + DEVICES_EFFECTIVE_FLAGS.AirConditioner.OperationMode;
								break
							case 3: //COOL
								deviceState.Power = true;
								deviceState.OperationMode = 3;
								deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.Power + DEVICES_EFFECTIVE_FLAGS.AirConditioner.OperationMode;
								break;
							case 7: //FAN
								deviceState.Power = true;
								deviceState.OperationMode = 7;
								deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.Power + DEVICES_EFFECTIVE_FLAGS.AirConditioner.OperationMode;
								break;
							case 8: //AUTO
								deviceState.Power = true;
								deviceState.OperationMode = 8;
								deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.Power + DEVICES_EFFECTIVE_FLAGS.AirConditioner.OperationMode;
								break;
							case 9: //PURIFY
								deviceState.Power = true;
								deviceState.OperationMode = 9;
								deviceState.EffectiveFlags = DEVICES_EFFECTIVE_FLAGS.AirConditioner.Power + DEVICES_EFFECTIVE_FLAGS.AirConditioner.OperationMode;
								break;
							case 10: //PHYSICAL LOCK CONTROLS
								deviceState.ProhibitSetTemperature = state;
								deviceState.ProhibitOperationMode = state;
								deviceState.ProhibitPower = state;
								break;
						}
						try {
							const newState = await this.melCloudDevice.send(deviceTypeUrl, deviceState, 0);
							const logInfo = this.disableLogInfo ? false : this.log(`${deviceTypeText}: ${accessoryName}, Set button mode: ${buttonName}`);
						} catch (error) {
							this.log.error(`${deviceTypeText}: ${accessoryName}, Set button error: ${error}`);
						};
					});

				this.buttonsServices.push(buttonService);
				accessory.addService(this.buttonsServices[i]);
			};
		};

		this.startPrepareAccessory = false;
		this.melCloudDevice.refreshDeviceState();
		this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
		const debug = this.enableDebugMode ? this.log(`${deviceTypeText}: ${accessoryName}, published as external accessory.`) : false;
	};
};