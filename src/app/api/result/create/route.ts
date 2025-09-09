import { createResult } from "@/app/_lib/service/result/create";
import { STATUS } from "@/app/_lib/statusCodes";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const req_data = await request.json();

        await createResult(req_data);

        return NextResponse.json({message: "Result successfully created"},{status: STATUS.OK});
    } catch (error) {
        console.error(error);
        return NextResponse.json({error: error}, {status: STATUS.ServerError});
    }
}
