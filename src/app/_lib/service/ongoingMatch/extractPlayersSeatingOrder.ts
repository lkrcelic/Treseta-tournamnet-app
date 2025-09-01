import {prisma} from "@/app/_lib/prisma";
import {PlayerPartialResponseValidation} from "@/app/_interfaces/player";

export async function extractPlayersSeatingOrder(dbOngoingMatch: unknown) {
    const {seating_order_ids} = dbOngoingMatch
    if (!seating_order_ids) {
        throw new Error("Incomplete seating data");
    }

    const dbSeatingOrderPlayers = await prisma.player.findMany({
        where: {
            id: {in: seating_order_ids},
        },
        select: {
            id: true,
            username: true,
            first_name: true,
            last_name: true,
        },
    });

    if (dbSeatingOrderPlayers.length !== seating_order_ids.length) {
        throw new Error("One or more players in seating_order not found");
    }

    return seating_order_ids.map((id) => {
        const player = dbSeatingOrderPlayers.find((player) => player.id === id);
        return PlayerPartialResponseValidation.parse(player);
    });
}