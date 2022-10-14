const axios = require("axios");

async function logger(res, type, cb) {
    const { status, data, config = {} } = res;
    cb(
        {
            status,
            data,
            request: {
                data: config.data,
                url: config.url,
                headers: config.headers,
            },
        },
        type
    );
}

/**
 * Callback function is called on response
 * @callback retryLogic
 * @param {object} res - Receives response as arguments
 */

/**
 * Callback function on response to log it on DB
 * @callback log
 * @param {object} data
 * @param {'response'|'request'} type
 */

/**
 * creates a instance
 * @param {object} config axios default config object
 * @param {string} config.baseURL axios default config object
 * @param {number} retryTime time in milliseconds before retrying the request
 * @param {log} log must be a function type
 * @param {retryLogic} retryLogic must be a function type
 * @returns {object} Axios Instance
 */
function create(
    config = {},
    retryTime = 1000,
    log = console.log,
    retryLogic = (res) => res.status !== 200
) {
    if (typeof log !== "function") {
        throw new Error("Logger must be function");
    }
    if (typeof retryLogic !== "function") {
        throw new Error("Retry must be function");
    }
    if (
        typeof retryTime !== "number" ||
        (retryTime < 0 && retryTime > 1000 * 60)
    ) {
        throw new Error("Retry must be number");
    }

    const instance = axios.create(config);

    async function retry(res) {
        if (!retryLogic(res)) {
            return res;
        }
        if (res.config.attempt > 2) {
            return Promise.reject(res);
        } else {
            return new Promise((resolve, _reject) => {
                setTimeout(async function () {
                    resolve(instance.request(res.config));
                }, retryTime);
            });
        }
    }

    instance.interceptors.response.use(
        (res) => {
            logger(res, "response", log);
            return retry(res);
        },
        (error) => {
            const { data, status } = error.response || {};
            logger({ ...error, data, status }, "response", log);
            return retry(error);
        }
    );

    instance.interceptors.request.use((config) => {
        if (config.attempt) {
            config.attempt++;
            config.headers = config._headers;
            config.data = config._data;
        } else {
            config._headers = config.headers;
            config._data = config.data;
            config.attempt = 1;
        }
        return config;
    });

    return instance;
}

module.exports = {
    create,
};
