import { getClientIp } from "./getClientIp";

export const getDeviceInfo = async () => {
    let deviceId = localStorage.getItem("device_id");

    if (!deviceId) {
        deviceId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        localStorage.setItem("device_id", deviceId);
    }

    const ipAddress = await getClientIp();

    return {
        device_id: deviceId,
        device_type: "web",
        os_version: navigator.platform,
        app_version: "1.0.0",
        fcm_token: null,
        user_agent: navigator.userAgent,
        ip_address: ipAddress,
    };
};