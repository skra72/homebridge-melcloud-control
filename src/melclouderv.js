"use strict";
const fs = require('fs');
const fsPromises = fs.promises;
const axios = require('axios');
const https = require('https');
const EventEmitter = require('events');
const CONSTANS = require('./constans.json');

class MelCloudErv extends EventEmitter {
    constructor(config) {
        super();
        const contextKey = config.contextKey;
        const deviceInfoFile = config.deviceInfoFile;
        const debugLog = config.debugLog;

        //set default values
        this.deviceData = {};
        this.displayDeviceInfo = true;

        this.axiosInstancePost = axios.create({
            method: 'POST',
            baseURL: CONSTANS.ApiUrls.BaseURL,
            timeout: 25000,
            headers: {
                'X-MitsContextKey': contextKey,
                'content-type': 'application/json'
            },
            withCredentials: true,
            httpsAgent: new https.Agent({
                keepAlive: false,
                rejectUnauthorized: false
            })
        });

        this.on('checkDevice', async () => {
            try {
                //read device info from file
                const deviceData = await this.readData(deviceInfoFile);
                const debug = debugLog ? this.emit('debug', `Info: ${JSON.stringify(deviceData, null, 2)}`) : false;

                if (!deviceData) {
                    this.checkDevice();
                    return;
                }

                //deviceData
                const deviceId = deviceData.DeviceID.toString();
                const deviceName = deviceData.DeviceName;
                const buildingId = deviceData.BuildingID;
                const buildingName = deviceData.BuildingName;
                const floorId = deviceData.FloorID;
                const floorName = deviceData.FloorName;
                const areaId = deviceData.AreaID;
                const areaName = deviceData.AreaName;
                const imageId = deviceData.ImageID;
                const installationDate = deviceData.InstallationDate;
                const lastServiceDate = deviceData.LastServiceDate;

                //presets
                const presets = deviceData.Presets ?? [];

                const ownerId = deviceData.OwnerID;
                const ownerName = deviceData.OwnerName;
                const ownerEmail = deviceData.OwnerEmail;
                const accessLevel = deviceData.AccessLevel;
                const directAccess = deviceData.DirectAccess;
                const endDate = deviceData.EndDate;
                const zone1Name = deviceData.Zone1Name;
                const zone2Name = deviceData.Zone2Name;
                const minTemperature = deviceData.MinTemperature;
                const maxTemperature = deviceData.MaxTemperature;
                const hideVaneControls = deviceData.HideVaneControls;
                const hideDryModeControl = deviceData.HideDryModeControl;
                const hideRoomTemperature = deviceData.HideRoomTemperature ?? false;
                const hideSupplyTemperature = deviceData.HideSupplyTemperature ?? false;
                const hideOutdoorTemperature = deviceData.HideOutdoorTemperature ?? false;
                const buildingCountry = deviceData.BuildingCountry;
                const ownerCountry = deviceData.OwnerCountry;
                const adaptorType = deviceData.AdaptorType;
                const linkedDevice = deviceData.LinkedDevice;
                const type = deviceData.Type;
                const macAddress = deviceData.MacAddress;
                const serialNumber = deviceData.SerialNumber ?? 'Undefined';

                //device
                const device = deviceData.Device ?? {};
                const pCycleActual = device.PCycleActual;
                const errorMessages = device.ErrorMessages;
                const deviceType = device.DeviceType;
                const ervFlags = device.ErvFlags;
                const ervModel = device.ErvModel;
                const labelControls = device.LabelControls;
                const devicePowerDisabled = device.DevicePowerDisabled;
                const silentMode = device.SilentMode;
                const deviceHolidayModde = device.DeviceHolidayMode;
                const externalControl = device.ExternalControl;
                const bypassVentilationSkipped = device.BypassVentilationSkipped;
                const autoVentilationSkipped = device.AutoVentilationSkipped;
                const fanSpeedSkipped = device.FanSpeedSkipped;
                const fanSpeedRestricted = device.FanSpeedRestricted;
                const hasTemperatureControlUnit = device.HasTemperatureControlUnit;
                const hasCoolOperationMode = device.HasCoolOperationMode;
                const hasHeatOperationMode = device.HasHeatOperationMode;
                const hasAutoOperationMode = device.HasAutoOperationMode;
                const hasBypassVentilationMode = device.HasBypassVentilationMode ?? false;
                const hasAutoVentilationMode = device.HasAutoVentilationMode ?? false;
                const hasRoomTemperature = device.HasRoomTemperature;
                const hasSupplyTemperature = device.HasSupplyTemperature;
                const hasOutdoorTemperature = device.HasOutdoorTemperature;
                const hasCO2Sensor = device.HasCO2Sensor;
                const hasPM25Sensor = device.HasPM25Sensor;
                const pM25SensorStatus = device.PM25SensorStatus;
                const pM25Level = device.PM25Level;
                const numberOfFanSpeeds = device.NumberOfFanSpeeds ?? 0;
                const hasHalfDegreeIncrements = device.HasHalfDegreeIncrements;
                const temperatureIncrementOverride = device.TemperatureIncrementOverride;
                const temperatureIncrement = device.TemperatureIncrement ?? 1;
                const minTempCoolDry = device.MinTempCoolDry;
                const maxTempCoolDry = device.MaxTempCoolDry;
                const minTempHeat = device.MinTempHeat;
                const maxTempHeat = device.MaxTempHeat;
                const minTempAutomatic = device.MinTempAutomatic;
                const maxTempAutomatic = device.MaxTempAutomatic;
                const setSupplyTemperatureMode = device.SetSupplyTemperatureMode;
                const hasAutomaticFanSpeed = device.HasAutomaticFanSpeed ?? false;
                const coreMaintenanceRequired = device.CoreMaintenanceRequired ?? false;
                const filterMaintenanceRequired = device.FilterMaintenanceRequired ?? false;
                const power = device.Power ?? false;
                const roomTemperature = device.RoomTemperature;
                const supplyTemperature = device.SupplyTemperature;
                const outdoorTemperature = device.OutdoorTemperature;
                const roomCO2Level = device.RoomCO2Level;
                const nightPurgeMode = device.NightPurgeMode ?? false;
                const thermostatOn = device.ThermostatOn;
                const setTemperature = device.SetTemperature ?? 20;
                const actualSupplyFanSpeed = device.ActualSupplyFanSpeed;
                const actualExhaustFanSpeed = device.ActualExhaustFanSpeed;
                const setFanSpeed = device.SetFanSpeed;
                const automaticFanSpeed = device.AutomaticFanSpeed;
                const operationMode = device.OperationMode; //0, Heat, 2, Cool, 4, 5, 6, Fan, Auto
                const actualOperationMode = device.ActualOperationMode;
                const ventilationMode = device.VentilationMode; //Lossnay, Bypass, Auto
                const actualVentilationMode = device.ActualVentilationMode; //Lossnay, Bypass
                const effectiveFlags = device.EffectiveFlags;
                const lastEffectiveFlags = device.LastEffectiveFlags;
                const defaultCoolingSetTemperature = device.DefaultCoolingSetTemperature ?? 23;
                const defaultHeatingSetTemperature = device.DefaultHeatingSetTemperature ?? 21;
                const hasEnergyConsumedMeter = device.HasEnergyConsumedMeter;
                const currentEnergyConsumed = device.CurrentEnergyConsumed
                const currentEnergyAssignment = device.CurrentEnergyAssignment;
                const coolingDisabled = device.CoolingDisabled
                const maxOutdoorUnits = device.MaxOutdoorUnits;
                const maxIndoorUnits = device.MaxIndoorUnits;
                const maxTemperatureControlUnits = device.MaxTemperatureControlUnits;
                const modelCode = device.ModelCode;
                //const deviceId = device.DeviceID;
                //const macAddress = device.MacAddress;
                //const serialNumber = device.SerialNumber;
                const timeZoneId = device.TimeZoneID;
                const diagnosticMode = device.DiagnosticMode;
                const diagnosticEndDate = device.DiagnosticEndDate;
                const expectedCommand = device.ExpectedCommand;
                const owner = device.Owner;
                const detectedCountry = device.DetectedCountry;
                //const adaptorType = device.AdaptorType;
                const firmwareDeployment = device.FirmwareDeployment;
                const firmwareUpdateAborted = device.FirmwareUpdateAborted;
                //const linkedDevice = device.LinkedDevice;
                const wifiSignalStrength = device.WifiSignalStrength;
                const wifiAdapterStatus = device.WifiAdapterStatus;
                const position = device.Position;
                const pCycle = device.PCycle;
                const pCycleConfigured = device.PCycleConfigured;
                const recordNumMax = device.RecordNumMax;
                const lastTimeStamp = device.LastTimeStamp;
                const errorCode = device.ErrorCode;
                const hasError = device.HasError;
                const lastReset = device.LastReset;
                const flashWrites = device.FlashWrites;
                const scene = device.Scene;
                const sSLExpirationDate = device.SSLExpirationDate;
                const sPTimeout = device.SPTimeout;
                const passcode = device.Passcode;
                const serverCommunicationDisabled = device.ServerCommunicationDisabled;
                const consecutiveUploadErrors = device.ConsecutiveUploadErrors;
                const doNotRespondAfter = device.DoNotRespondAfter;
                const ownerRoleAccessLevel = device.OwnerRoleAccessLevel;
                //const ownerCountry = device.OwnerCountry;
                const hideEnergyReport = device.HideEnergyReport;
                const exceptionHash = device.ExceptionHash;
                const exceptionDate = device.ExceptionDate;
                const exceptionCount = device.ExceptionCount;
                const rate1StartTime = device.Rate1StartTime;
                const rate2StartTime = device.Rate2StartTime;
                const protocolVersion = device.ProtocolVersion;
                const unitVersion = device.UnitVersion;
                const firmwareAppVersion = device.FirmwareAppVersion?.toString() ?? 'Undefined';
                const firmwareWebVersion = device.FirmwareWebVersion;
                const firmwareWlanVersion = device.FirmwareWlanVersion;
                const effectivePCycle = device.EffectivePCycle;
                const mqttFlags = device.MqttFlags;
                const hasErrorMessages = device.HasErrorMessages;
                const hasZone2 = device.HasZone2;
                const offline = device.Offline ?? false;
                const minPcycle = device.MinPcycle;
                const maxPcycle = device.MaxPcycle;
                const supportsHourlyEnergyReport = device.SupportsHourlyEnergyReport;

                //units
                const units = Array.isArray(device.Units) ? device.Units : [];
                const unitsCount = units.length;
                const manufacturer = 'Mitsubishi';

                //indoor
                let idIndoor = 0;
                let deviceIndoor = 0;
                let serialNumberIndoor = 'Undefined';
                let modelNumberIndoor = 0;
                let modelIndoor = false;
                let typeIndoor = 0;

                //outdoor
                let idOutdoor = 0;
                let deviceOutdoor = 0;
                let serialNumberOutdoor = 'Undefined';
                let modelNumberOutdoor = 0;
                let modelOutdoor = false;
                let typeOutdoor = 0;

                //units array
                for (const unit of units) {
                    const unitId = unit.ID;
                    const unitDevice = unit.Device;
                    const unitSerialNumber = unit.SerialNumber ?? 'Undefined';
                    const unitModelNumber = unit.ModelNumber;
                    const unitModel = unit.Model ?? false;
                    const unitType = unit.UnitType;
                    const unitIsIndoor = unit.IsIndoor ?? false;

                    switch (unitIsIndoor) {
                        case true:
                            idIndoor = unitId;
                            deviceIndoor = unitDevice;
                            serialNumberIndoor = unitSerialNumber;
                            modelNumberIndoor = unitModelNumber;
                            modelIndoor = unitModel;
                            typeIndoor = unitType;
                            break;
                        case false:
                            idOutdoor = unitId;
                            deviceOutdoor = unitDevice;
                            serialNumberOutdoor = unitSerialNumber;
                            modelNumberOutdoor = unitModelNumber;
                            modelOutdoor = unitModel;
                            typeOutdoor = unitType;
                            break;
                    }
                }

                //diagnostic
                //const diagnosticMode = deviceData.DiagnosticMode;
                //const diagnosticEndDate = deviceData.DiagnosticEndDate;
                const location = deviceData.Location;
                //const detectedCountry = deviceData.DetectedCountry;
                const registrations = deviceData.Registrations;
                const localIPAddress = deviceData.LocalIPAddress;
                const timeZone = deviceData.TimeZone;
                const registReason = deviceData.RegistReason;
                //const expectedCommand = deviceData.ExpectedCommand;
                const registRetry = deviceData.RegistRetry;
                const dateCreated = deviceData.DateCreated;
                //const firmwareDeployment = deviceData.FirmwareDeployment;
                //const firmwareUpdateAborted = deviceData.FirmwareUpdateAborted;

                //permissions
                const permissionCanSetOperationMode = deviceData.Permissions.CanSetOperationMode;
                const permissionCanSetFanSpeed = deviceData.Permissions.CanSetFanSpeed;
                const permissionCanSetVaneDirection = deviceData.Permissions.CanSetVaneDirection;
                const permissionCanSetPower = deviceData.Permissions.CanSetPower;
                const permissionCanSetTemperatureIncrementOverride = deviceData.Permissions.CanSetTemperatureIncrementOverride;
                const permissionCanDisableLocalController = deviceData.Permissions.CanDisableLocalController;

                //display info if units are not configured in MELCloud service
                if (unitsCount === 0) {
                    this.emit('message', `Units are not configured in MELCloud service.`);
                };

                //emit info
                const emitInfo = this.displayDeviceInfo ? this.emit('deviceInfo', manufacturer, modelIndoor, modelOutdoor, serialNumber, firmwareAppVersion) : false;
                this.displayDeviceInfo = false;

                //restFul
                this.emit('restFul', 'info', deviceData);

                //mqtt
                this.emit('mqtt', `Info`, deviceData);

                //device state
                const deviceState = {
                    DeviceId: deviceId,
                    EffectiveFlags: effectiveFlags,
                    RoomTemperature: roomTemperature,
                    SupplyTemperature: supplyTemperature,
                    OutdoorTemperature: outdoorTemperature,
                    NightPurgeMode: nightPurgeMode,
                    SetTemperature: setTemperature,
                    SetFanSpeed: setFanSpeed,
                    OperationMode: operationMode,
                    VentilationMode: ventilationMode,
                    DefaultCoolingSetTemperature: defaultCoolingSetTemperature,
                    DefaultHeatingSetTemperature: defaultHeatingSetTemperature,
                    HideRoomTemperature: hideRoomTemperature,
                    HideSupplyTemperature: hideSupplyTemperature,
                    HideOutdoorTemperature: hideOutdoorTemperature,
                    Power: power,
                    Offline: offline,
                }

                const stateHasNotChanged = JSON.stringify(deviceData) === JSON.stringify(this.deviceData);
                const someValeueNullOrUndefined = Object.values(deviceState).some(value => value === undefined || value === null);
                if (someValeueNullOrUndefined || stateHasNotChanged) {
                    this.checkDevice();
                    return;
                }
                this.deviceData = deviceData;

                //emit state changes
                this.emit('deviceState', deviceData, deviceState);

                //restFul
                this.emit('restFul', 'state', deviceState);

                //mqtt
                this.emit('mqtt', `State`, deviceState);
                this.checkDevice();
            } catch (error) {
                this.emit('error', `Check device error: ${error}.`);
                this.checkDevice();
            };
        });

        this.emit('checkDevice');
    };

    async checkDevice() {
        await new Promise(resolve => setTimeout(resolve, 15000));
        this.emit('checkDevice');
    };

    readData(path) {
        return new Promise(async (resolve, reject) => {
            try {
                const savedData = await fsPromises.readFile(path)
                const data = savedData.length > 0 ? JSON.parse(savedData) : false;
                resolve(data);
            } catch (error) {
                reject(`Read data from path: ${path}, error: ${error}`);
            }
        });
    }

    send(deviceState) {
        return new Promise(async (resolve, reject) => {
            try {
                deviceState.HasPendingCommand = true;
                const options = {
                    data: deviceState
                };

                await this.axiosInstancePost(CONSTANS.ApiUrls.SetErv, options);
                this.emit('deviceStaate', this.deviceData, deviceState);
                resolve();
            } catch (error) {
                reject(error);
            };
        });
    };
};
module.exports = MelCloudErv;
