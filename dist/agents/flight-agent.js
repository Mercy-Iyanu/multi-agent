import { chat } from "../llm.js";
export async function runFlightAgent(request, tools, context) {
    const result = await chat([
        {
            role: "user",
            content: `
Find flight options.

Origin: ${request.origin}
Destination: ${request.destination}
Departure: ${request.departureDate}
Return: ${request.returnDate}
Adults: ${request.adults}

Return 2-3 good options with approximate pricing.
        `,
        },
    ], tools, context);
    return {
        summary: result.response,
    };
}
