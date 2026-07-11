import { singleCall } from "./call.js";
export async function reviewFlightOptions(flightResultsText, passengerCount) {
    const input = `Here are the flight options presented to the traveller:\n\n${flightResultsText}`;
    const [flightSpecialist, convenienceSpecialist, budgetAnalyst, familyReviewer] = await Promise.all([
        singleCall("You are a Flight Specialist. Identify the cheapest option and the best value for money. One sentence only.", input),
        singleCall("You are a Convenience Specialist. Identify which option has the shortest travel time, fewest layovers, or best same-day arrival. One sentence only.", input),
        singleCall("You are a Budget Analyst. Quantify the price differences between the options using dollar amounts or percentages. One sentence only.", input),
        singleCall(`You are a Family Travel Reviewer. Assess which option suits a group of ${passengerCount} travellers best, considering overnight layovers, total journey duration, and comfort. One sentence only.`, input),
    ]);
    const synthesisInput = `Four specialists have reviewed the flight options for a group of ${passengerCount} traveller(s).

Flight Specialist: ${flightSpecialist}
Convenience Specialist: ${convenienceSpecialist}
Budget Analyst: ${budgetAnalyst}
Family Reviewer: ${familyReviewer}

Based on their input, write a single recommendation naming the best option and why. Two sentences maximum.`;
    const recommendation = await singleCall("You are a senior travel advisor giving a final flight recommendation based on specialist input.", synthesisInput);
    return {
        panel: { flightSpecialist, convenienceSpecialist, budgetAnalyst, familyReviewer },
        recommendation,
    };
}
