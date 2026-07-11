import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { config } from "../config.js";
export async function singleCall(systemPrompt, userMessage) {
    const provider = config.llm.provider;
    if (provider === "anthropic") {
        const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });
        const response = await client.messages.create({
            model: config.llm.anthropic.model,
            max_tokens: 512,
            system: systemPrompt,
            messages: [{ role: "user", content: userMessage }],
        });
        return response.content
            .map((b) => ("text" in b ? b.text : ""))
            .join("")
            .trim();
    }
    const clientOptions = provider === "mistral"
        ? { apiKey: config.llm.mistral.apiKey, baseURL: config.llm.mistral.baseUrl }
        : { apiKey: config.llm.openai.apiKey };
    const model = provider === "mistral" ? config.llm.mistral.model : config.llm.openai.model;
    const client = new OpenAI(clientOptions);
    const response = await client.chat.completions.create({
        model,
        max_tokens: 512,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
        ],
    });
    return (response.choices[0]?.message.content ?? "").trim();
}
