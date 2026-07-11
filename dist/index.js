import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import ora from "ora";
import { marked } from "marked";
import markedTerminal from "marked-terminal";
import { connectMcp, disconnectMcp, listTools } from "./mcp-client.js";
import { chat } from "./llm.js";
import { reviewFlightOptions } from "./review/engine.js";
function printBanner() {
    console.clear();
    console.log(chalk.cyanBright(`
╔══════════════════════════════════════════════╗
║           RouteStack Trip Planner            ║
╚══════════════════════════════════════════════╝
`));
    console.log(chalk.gray("Natural language travel planning"));
    console.log(chalk.gray('Example: "Plan a trip from Mumbai to Tokyo from 2026-06-10 to 2026-06-16 for 2 adults"\n'));
}
function printUser(text) {
    console.log(chalk.blueBright("You"));
    console.log(chalk.white(text));
    console.log();
}
function printAssistant(text) {
    console.log(chalk.greenBright("Assistant"));
    console.log(String(marked.parse(text)).trim());
    console.log();
}
function printReviewPanel(review) {
    const bar = chalk.dim("─".repeat(62));
    console.log(bar);
    console.log(chalk.bold.yellowBright("  Internal Review"));
    console.log(bar);
    console.log(chalk.bold("  Flight Specialist    ") + chalk.white(review.panel.flightSpecialist));
    console.log();
    console.log(chalk.bold("  Convenience          ") + chalk.white(review.panel.convenienceSpecialist));
    console.log();
    console.log(chalk.bold("  Budget Analyst       ") + chalk.white(review.panel.budgetAnalyst));
    console.log();
    console.log(chalk.bold("  Family Reviewer      ") + chalk.white(review.panel.familyReviewer));
    console.log(bar);
    console.log(chalk.bold.cyanBright("  Recommended: ") + chalk.white(review.recommendation));
    console.log(bar);
    console.log();
}
function hasNewFlightResults(context, reviewedSessions) {
    const sessionId = context.flight.sessionId;
    const hasFlights = (context.flight.flights?.length ?? 0) > 0;
    if (!hasFlights || !sessionId)
        return false;
    return !reviewedSessions.has(sessionId);
}
function extractPassengerCount(messages) {
    for (const m of [...messages].reverse()) {
        if (m.role !== "user")
            continue;
        const familyOf = m.content.match(/family\s+of\s+(\d+)/i);
        if (familyOf)
            return parseInt(familyOf[1], 10);
        const standard = m.content.match(/(\d+)\s*(adult|passenger|people|person|travell?er)/i);
        if (standard)
            return parseInt(standard[1], 10);
    }
    return 1;
}
function printTool(name, args) {
    console.log(chalk.yellow(`  ↳ tool: ${name}`));
    const formatted = JSON.stringify(args, null, 2)
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n");
    console.log(chalk.gray(formatted));
    console.log();
}
marked.setOptions({
    renderer: new markedTerminal({
        code: chalk.gray,
        blockquote: chalk.gray,
    }),
});
async function main() {
    await connectMcp();
    const tools = await listTools();
    const rl = readline.createInterface({
        input,
        output,
    });
    let shuttingDown = false;
    async function shutdown() {
        if (shuttingDown)
            return;
        shuttingDown = true;
        rl.close();
        await disconnectMcp();
        console.log(chalk.gray("\nGoodbye.\n"));
        process.exit(0);
    }
    process.on("SIGINT", async () => {
        await shutdown();
    });
    const messages = [];
    const reviewedFlightSessions = new Set();
    const context = {
        hotel: {},
        flight: {},
        car: {}
    };
    printBanner();
    while (true) {
        let userInput;
        try {
            userInput = await rl.question(chalk.blue("> "));
        }
        catch (err) {
            if (err?.code === "ABORT_ERR") {
                await shutdown();
                return;
            }
            throw err;
        }
        if (!userInput.trim()) {
            continue;
        }
        if (userInput.toLowerCase() === "exit" ||
            userInput.toLowerCase() === "quit") {
            break;
        }
        messages.push({
            role: "user",
            content: userInput,
        });
        printUser(userInput);
        const spinner = ora({
            text: "Thinking...",
            discardStdin: false,
        }).start();
        try {
            const result = await chat(messages, tools, context, (toolName, args) => {
                spinner.stop();
                printTool(toolName, args);
                spinner.start("Working...");
            });
            spinner.stop();
            printAssistant(result.response);
            if (hasNewFlightResults(context, reviewedFlightSessions)) {
                reviewedFlightSessions.add(context.flight.sessionId);
                const reviewSpinner = ora({ text: "Reviewing options...", discardStdin: false }).start();
                try {
                    const passengerCount = extractPassengerCount(messages);
                    const review = await reviewFlightOptions(result.response, passengerCount);
                    reviewSpinner.stop();
                    printReviewPanel(review);
                }
                catch (err) {
                    reviewSpinner.stop();
                    console.log(chalk.dim("  [review skipped: " + (err instanceof Error ? err.message : String(err)) + "]"));
                }
            }
            messages.push({
                role: "assistant",
                content: result.response,
            });
        }
        catch (err) {
            spinner.stop();
            console.log(chalk.redBright("Error"));
            console.log(chalk.red(err instanceof Error ? err.message : String(err)));
            console.log();
        }
    }
    rl.close();
    await disconnectMcp();
    console.log(chalk.gray("\nGoodbye.\n"));
}
main().catch(async (err) => {
    if (err?.code === "ABORT_ERR") {
        console.log(chalk.gray("\nGoodbye.\n"));
        process.exit(0);
    }
    console.error(err);
    await disconnectMcp();
    process.exit(1);
});
