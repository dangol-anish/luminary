"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setFetch = setFetch;
exports.evaluateCall = evaluateCall;
const cross_fetch_1 = __importDefault(require("cross-fetch"));
const DEFAULT_ENDPOINT = "http://localhost:3000/api/evaluate";
let fetchFn = cross_fetch_1.default;
function setFetch(fn) {
    fetchFn = fn;
}
async function evaluateCall(input) {
    var _a;
    if (!input.prompt || !input.response) {
        throw new Error("prompt and response are required");
    }
    const endpoint = (_a = input.endpoint) !== null && _a !== void 0 ? _a : DEFAULT_ENDPOINT;
    const body = {
        prompt: input.prompt,
        response: input.response,
        model: input.model,
        sdk_version: input.sdk_version,
        user_id: input.user_id,
        project: input.project,
    };
    const response = await fetchFn(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Evaluation API request failed: ${response.status} ${text}`);
    }
    const json = (await response.json());
    return json;
}
