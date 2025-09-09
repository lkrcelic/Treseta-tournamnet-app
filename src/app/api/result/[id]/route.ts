import { ResultCreateRequestValidation, ResultResponseValidation } from "@/app/_interfaces/result";
import { prisma } from "@/app/_lib/prisma";
import { updateMatchScore } from "@/app/_lib/service/match/update";
import { getResultbyId } from "@/app/_lib/service/result/getById";
import { updateResultById } from "@/app/_lib/service/result/updateById";
import { STATUS } from "@/app/_lib/statusCodes";
import { NextResponse } from "next/server";

export async function GET(request: Request, {params}: {params: {id: string}}): Promise<Response> {
  const {id} = params;

  try {
    const dbResult = await getResultbyId(Number(id));

    const result = ResultResponseValidation.parse(dbResult);

    return NextResponse.json(result, {status: STATUS.OK});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error: "Failed to fetch result."}, {status: STATUS.BadRequest});
  }
}

export async function PUT(request: Request, {params}: {params: {id: string}}): Promise<NextResponse> {
  const {id} = params;

  try {
    const req_data = await request.json();
    const resultData = ResultCreateRequestValidation.parse(req_data);

    await prisma.$transaction(async () => {
      await updateMatchScore({result_id: Number(id), resultData: resultData});
      await updateResultById({result_id: Number(id), resultData: resultData});
    });
    return NextResponse.json({message: "Result successfully created"}, {status: STATUS.OK});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error: error}, {status: STATUS.ServerError});
  }
}
