import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import crypto from "node:crypto";
import { config } from "./config.js";
let client = null;
let cachedPartnerToken = null;
console.log("apiKey =", config.routestack.apiKey);
console.log("secret exists =", !!config.routestack.apiSecret);
async function getPartnerToken() {
    if (cachedPartnerToken)
        return cachedPartnerToken;
    const { apiKey, apiSecret, mcpUrl } = config.routestack;
    if (!apiSecret) {
        // If no secret is configured, fall back to using apiKey directly as a bearer token.
        // (Some deployments support this, but evolvemcp requires the partner-token flow.)
        return apiKey;
    }
    const ts = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomUUID();
    const hmac = crypto
        .createHmac("sha256", apiSecret)
        .update(`${apiKey}:${ts}:${nonce}`)
        .digest("base64url");
    const base = new URL(mcpUrl);
    const tokenUrl = new URL("/mcp/auth/partner-token", base.origin);
    console.log("tokenUrl =", tokenUrl.toString());
    const res = await fetch(tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey, hmac, timestamp: ts, nonce }),
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Partner-token request failed (${res.status}): ${text}`);
    }
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        throw new Error(`Partner-token response was not JSON: ${text}`);
    }
    const token = data.token ??
        data.accessToken ??
        data.partnerToken ??
        data.jwt;
    if (!token || typeof token !== "string") {
        throw new Error(`Partner-token response missing token field: ${text}`);
    }
    cachedPartnerToken = token;
    return token;
    const result = await getPartnerToken();
    console.log(result);
}
export async function connectMcp() {
    const { mcpUrl } = config.routestack;
    console.log("mcpUrl =", JSON.stringify(mcpUrl));
    const url = new URL(mcpUrl);
    const token = await getPartnerToken();
    const headers = {
        Authorization: `Bearer ${token}`,
    };
    client = new Client({ name: "routestack-chat", version: "0.1.0" });
    try {
        const transport = new StreamableHTTPClientTransport(url, {
            requestInit: { headers },
        });
        await client.connect(transport);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const isTransportMismatch = message.includes("404") ||
            message.includes("405") ||
            message.includes("Not Found") ||
            message.includes("Method Not Allowed");
        if (!isTransportMismatch)
            throw err;
        await client.close().catch(() => { });
        client = new Client({ name: "routestack-chat", version: "0.1.0" });
        const sseTransport = new SSEClientTransport(url, {
            requestInit: { headers },
        });
        await client.connect(sseTransport);
    }
}
export async function listTools() {
    if (!client)
        throw new Error("MCP client not connected");
    const allTools = [];
    let cursor;
    do {
        const result = await client.listTools({ cursor });
        allTools.push(...result.tools.map((t) => ({
            name: t.name,
            description: t.description ?? "",
            inputSchema: (t.inputSchema ?? {}),
        })));
        cursor = result.nextCursor;
    } while (cursor);
    return allTools;
}
export async function callTool(name, args) {
    if (!client)
        throw new Error("MCP client not connected");
    const result = await client.callTool({ name, arguments: args });
    return {
        content: (result.content ?? []),
        isError: result.isError,
    };
}
export async function disconnectMcp() {
    if (client) {
        await client.close();
        client = null;
    }
}
