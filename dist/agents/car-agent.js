import { chat } from "../llm.js";
export async function runCarAgent(request, tools, context) {
    const result = await chat([
        {
            role: "user",
            content: `
Find car rental options.

Pickup city: ${request.destination}
Pickup date: ${request.departureDate}
Drop date: ${request.returnDate}

Return 2-3 suitable car rental options.
        `,
        },
    ], tools, context);
    return {
        summary: result.response,
    };
}
